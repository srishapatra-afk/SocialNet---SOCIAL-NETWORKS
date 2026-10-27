import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import neo4j from 'neo4j-driver';
import { getSession } from '../config/neo4j';
import { getNextSequence } from '../services/counter.service';

// --- Zod Input Validation Schemas ---

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Please provide a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(100)
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional().default('prefer_not_to_say'),
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Handle new user registration.
 */
export async function register(req: Request, res: Response): Promise<void> {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues.map((i) => i.message);
    res.status(400).json({ error: errorMessages[0], details: errorMessages });
    return;
  }

  const { firstName, lastName, username, email, password, gender } = parseResult.data;

  const readSession = getSession(neo4j.session.READ);
  try {
    // 1. Check for duplicate username or email using parameterized query
    const checkResult = await readSession.run(
      `
      MATCH (u:User)
      WHERE u.username = $username OR toLower(u.email) = toLower($email)
      RETURN u.username AS username, u.email AS email
      LIMIT 1
      `,
      { username, email }
    );

    if (checkResult.records.length > 0) {
      const match = checkResult.records[0];
      const isUsernameTaken = match.get('username') === username;
      res.status(409).json({
        error: isUsernameTaken
          ? 'Username is already taken. Please choose another.'
          : 'Email is already registered. Please log in.',
      });
      return;
    }
  } finally {
    await readSession.close();
  }

  // 2. Concurrency-safe ID allocation
  const nextUserId = await getNextSequence('User', 102);

  // 3. Hash password with bcrypt (10 rounds)
  const passwordHash = await bcrypt.hash(password, 10);

  // 4. Create User node in Neo4j
  const writeSession = getSession(neo4j.session.WRITE);
  try {
    const createResult = await writeSession.run(
      `
      CREATE (u:User {
        userId: $userId,
        username: $username,
        email: toLower($email),
        firstName: $firstName,
        lastName: $lastName,
        gender: $gender,
        accountStatus: 'active',
        passwordHash: $passwordHash,
        createdAt: datetime()
      })
      RETURN u.userId AS userId, u.username AS username, u.email AS email, u.firstName AS firstName, u.lastName AS lastName, u.accountStatus AS accountStatus
      `,
      {
        userId: neo4j.int(nextUserId),
        username,
        email,
        firstName,
        lastName,
        gender,
        passwordHash,
      }
    );

    const record = createResult.records[0];
    const user = {
      userId: record.get('userId').toInt(),
      username: record.get('username'),
      email: record.get('email'),
      firstName: record.get('firstName'),
      lastName: record.get('lastName'),
      accountStatus: record.get('accountStatus'),
    };

    // 5. Establish session & regenerate session ID to prevent session fixation
    req.session.regenerate((err) => {
      if (err) {
        console.error('[Session Error during register]:', err);
        res.status(500).json({ error: 'Session creation failed after registration' });
        return;
      }
      req.session.userId = user.userId;
      req.session.username = user.username;
      res.status(201).json({ status: 'success', user });
    });
  } catch (error) {
    console.error('[Register Write Error]:', error);
    res.status(500).json({ error: 'Failed to create user record' });
  } finally {
    await writeSession.close();
  }
}

/**
 * Handle user login with email/username and password.
 */
export async function login(req: Request, res: Response): Promise<void> {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Username/email and password are required' });
    return;
  }

  const { identifier, password } = parseResult.data;

  const session = getSession(neo4j.session.READ);
  try {
    // 1. Parameterized Cypher query matching username OR email
    const queryResult = await session.run(
      `
      MATCH (u:User)
      WHERE u.username = $identifier OR toLower(u.email) = toLower($identifier)
      RETURN u.userId AS userId,
             u.username AS username,
             u.email AS email,
             u.firstName AS firstName,
             u.lastName AS lastName,
             u.passwordHash AS passwordHash,
             u.accountStatus AS accountStatus
      LIMIT 1
      `,
      { identifier }
    );

    // 2. Generic authentication failure if user not found (prevents user enumeration)
    if (queryResult.records.length === 0) {
      res.status(401).json({ error: 'Invalid username/email or password' });
      return;
    }

    const record = queryResult.records[0];
    const passwordHash = record.get('passwordHash');

    // 3. Check for unactivated demo accounts (no passwordHash set yet)
    if (!passwordHash) {
      res.status(403).json({
        error:
          'This account has not been activated with a password yet. Please run the administrative activation script or register a new account.',
      });
      return;
    }

    // 4. Verify password with bcrypt
    const isPasswordMatch = await bcrypt.compare(password, passwordHash);
    if (!isPasswordMatch) {
      res.status(401).json({ error: 'Invalid username/email or password' });
      return;
    }

    const user = {
      userId: record.get('userId').toInt(),
      username: record.get('username'),
      email: record.get('email'),
      firstName: record.get('firstName'),
      lastName: record.get('lastName'),
      accountStatus: record.get('accountStatus'),
    };

    // 5. Regenerate session to protect against session fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        console.error('[Session Error during login]:', err);
        res.status(500).json({ error: 'Failed to establish user session' });
        return;
      }
      req.session.userId = user.userId;
      req.session.username = user.username;
      res.json({ status: 'success', user });
    });
  } catch (error) {
    console.error('[Login Query Error]:', error);
    res.status(500).json({ error: 'Authentication service error' });
  } finally {
    await session.close();
  }
}

/**
 * Handle user logout and session destruction.
 */
export async function logout(req: Request, res: Response): Promise<void> {
  req.session.destroy((err) => {
    if (err) {
      console.error('[Logout Session Destroy Error]:', err);
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    res.clearCookie('socialnet.sid');
    res.json({ status: 'success', message: 'Logged out successfully' });
  });
}

/**
 * Return current session user details (if authenticated).
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ authenticated: false });
    return;
  }

  const session = getSession(neo4j.session.READ);
  try {
    const result = await session.run(
      `
      MATCH (u:User { userId: $userId })
      RETURN u.userId AS userId,
             u.username AS username,
             u.email AS email,
             u.firstName AS firstName,
             u.lastName AS lastName,
             u.accountStatus AS accountStatus
      LIMIT 1
      `,
      { userId: neo4j.int(userId) }
    );

    if (result.records.length === 0) {
      req.session.destroy(() => {});
      res.status(401).json({ authenticated: false });
      return;
    }

    const record = result.records[0];
    const user = {
      userId: record.get('userId').toInt(),
      username: record.get('username'),
      email: record.get('email'),
      firstName: record.get('firstName'),
      lastName: record.get('lastName'),
      accountStatus: record.get('accountStatus'),
    };

    res.json({ authenticated: true, user });
  } catch (error) {
    console.error('[getMe Query Error]:', error);
    res.status(500).json({ error: 'Database error reading session profile' });
  } finally {
    await session.close();
  }
}
