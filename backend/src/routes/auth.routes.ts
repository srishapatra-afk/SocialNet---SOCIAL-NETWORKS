import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Authentication endpoints protected by rate limiting
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/logout', logout);
router.get('/me', getMe);

export default router;
