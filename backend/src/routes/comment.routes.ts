import { Router } from 'express';
import { deleteComment } from '../controllers/comment.controller';

const router = Router();

// Delete a comment endpoint
router.delete('/:commentId', deleteComment);

export default router;
