import { api } from './api';
import { Notification } from '../types';

export interface NotificationsResponse {
  status: 'success' | 'error';
  data: {
    notifications: Notification[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
}

export interface UnreadCountResponse {
  status: 'success' | 'error';
  data: {
    unreadCount: number;
  };
}

export interface MarkReadResponse {
  status: 'success' | 'error';
  data: {
    notificationId: string;
    isRead: boolean;
  };
}

export interface MarkAllReadResponse {
  status: 'success' | 'error';
  data: {
    updatedCount: number;
  };
}

/**
 * Fetch paginated notifications for the logged-in user.
 */
export async function fetchNotifications(
  page: number = 1,
  limit: number = 20
): Promise<NotificationsResponse['data']> {
  const response = await api.get<NotificationsResponse>('/notifications', {
    params: { page, limit },
  });
  return response.data.data;
}

/**
 * Fetch the current unread notifications count.
 */
export async function fetchUnreadCount(): Promise<number> {
  const response = await api.get<UnreadCountResponse>('/notifications/unread-count');
  return response.data.data.unreadCount;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<MarkReadResponse['data']> {
  const response = await api.patch<MarkReadResponse>(`/notifications/${notificationId}/read`);
  return response.data.data;
}

/**
 * Mark all notifications for the logged-in user as read.
 */
export async function markAllNotificationsAsRead(): Promise<number> {
  const response = await api.patch<MarkAllReadResponse>('/notifications/read-all');
  return response.data.data.updatedCount;
}
