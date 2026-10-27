import { Router } from 'express';
import { getFeed, createPost, likePost, unlikePost } from '../controllers/post.controller';
import { getCommentsForPost, createComment } from '../controllers/comment.controller';

const router = Router();

// Read-only feed endpoint
router.get('/', getFeed);

// Create post endpoint
router.post('/', createPost);

// Like & Unlike post endpoints
router.put('/:postId/like', likePost);
router.delete('/:postId/like', unlikePost);

// Comment on post endpoints
router.get('/:postId/comments', getCommentsForPost);
router.post('/:postId/comments', createComment);

export default router;
