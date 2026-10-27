import session from 'express-session';
import { env } from '../config/env';

/**
 * Server-managed session middleware.
 * Uses HttpOnly, SameSite, and Secure (in production) cookies to guard session state.
 */
export const sessionMiddleware = session({
  name: 'socialnet.sid',
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});
