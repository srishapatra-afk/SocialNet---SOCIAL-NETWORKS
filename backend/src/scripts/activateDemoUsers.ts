import bcrypt from 'bcryptjs';
import neo4j from 'neo4j-driver';
import { getSession, closeDriver } from '../config/neo4j';

/**
 * Administrative CLI Script: Explicit Activation of Existing Demo Users.
 * Fulfills Architectural Decision 1: Preserves sample records (101 aditya_demo, 102 srisha_demo)
 * by initializing secure bcrypt password hashes without storing plaintext passwords.
 */
async function activateDemoUsers() {
  console.log('--- SocialNet Administrative CLI: Activating Demo Accounts ---');

  const demoAccounts = [
    {
      userId: 101,
      username: 'aditya_demo',
      defaultPassword: process.env.ADITYA_DEMO_PASSWORD || 'Aditya@VIT2026!',
    },
    {
      userId: 102,
      username: 'srisha_demo',
      defaultPassword: process.env.SRISHA_DEMO_PASSWORD || 'Srisha@VIT2026!',
    },
  ];

  const session = getSession(neo4j.session.WRITE);

  try {
    for (const account of demoAccounts) {
      console.log(`\nProcessing account: ${account.username} (ID: ${account.userId})...`);

      // Hash password using 10 bcrypt salt rounds
      const passwordHash = await bcrypt.hash(account.defaultPassword, 10);

      const result = await session.run(
        `
        MATCH (u:User { userId: $userId })
        SET u.passwordHash = $passwordHash,
            u.accountStatus = 'active',
            u.updatedAt = datetime()
        RETURN u.userId AS userId, u.username AS username, u.email AS email
        `,
        {
          userId: neo4j.int(account.userId),
          passwordHash,
        }
      );

      if (result.records.length > 0) {
        const record = result.records[0];
        console.log(
          `[SUCCESS] Account activated: @${record.get('username')} (${record.get('email')})`
        );
      } else {
        console.warn(`[WARN] User with ID ${account.userId} not found in Neo4j database.`);
      }
    }

    console.log('\n--- Demo accounts activation complete ---');
  } catch (error) {
    console.error('[FATAL] Failed to activate demo accounts:', error);
  } finally {
    await session.close();
    await closeDriver();
  }
}

activateDemoUsers();
