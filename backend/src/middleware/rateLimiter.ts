import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Rate limiter for authentication routes.
 * Mitigates brute-force credential stuffing and DoS attempts.
 * Automatically bypassed in test environment to avoid cross-suite IP rate limit starvation.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: {
    error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
});
