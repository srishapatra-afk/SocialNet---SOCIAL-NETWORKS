import { Router } from 'express';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../controllers/notification.controller';

const router = Router();

// List notifications & unread count
router.get('/', getNotifications);
router.get('/unread-count', getUnreadNotificationCount);

// Mark as read
router.patch('/read-all', markAllNotificationsAsRead);
router.patch('/:notificationId/read', markNotificationAsRead);

export default router;
