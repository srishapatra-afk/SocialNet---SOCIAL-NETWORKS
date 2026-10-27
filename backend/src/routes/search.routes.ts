import { Router } from 'express';
import { search } from '../controllers/search.controller';

const router = Router();

/**
 * GET /api/search?q=<query>&type=all&page=1&limit=10
 * Search for users and posts.
 * Publicly accessible to both guests and authenticated users.
 */
router.get('/', search);

export default router;
