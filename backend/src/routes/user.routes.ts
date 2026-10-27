import { Router } from 'express';
import {
  getUserProfile,
  getUserPosts,
  followUser,
  unfollowUser,
} from '../controllers/user.controller';

const router = Router();

// User profile and user posts
router.get('/:userId/profile', getUserProfile);
router.get('/:userId/posts', getUserPosts);

// Follow / Unfollow endpoints
router.put('/:userId/follow', followUser);
router.delete('/:userId/follow', unfollowUser);

export default router;
