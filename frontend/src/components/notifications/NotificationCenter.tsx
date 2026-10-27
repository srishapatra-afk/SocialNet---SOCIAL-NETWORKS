import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Notification } from '../../types';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../services/notificationService';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import {
  Heart,
  MessageCircle,
  UserPlus,
  Bell,
  CheckCheck,
  RefreshCw,
  AlertCircle,
  Loader2,
  LogIn,
  ArrowRight,
} from 'lucide-react';
import { formatTimeAgo } from '../../utils/cn';

export interface NotificationCenterProps {
  onNavigateProfile?: (userId: number) => void;
  onNavigateLogin?: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  onNavigateProfile,
  onNavigateLogin,
  onUnreadCountChange,
}) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingReadIds, setPendingReadIds] = useState<Set<string>>(new Set());
  const [isMarkingAllRead, setIsMarkingAllRead] = useState<boolean>(false);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications(1, 30);
      setNotifications(data.notifications || []);
      const unread = (data.notifications || []).filter((n) => !n.isRead).length;
      onUnreadCountChange?.(unread);
    } catch (err: any) {
      console.error('[Load Notifications Error]:', err);
      setError(err.response?.data?.error || 'Failed to load notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, onUnreadCountChange]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Handle marking a single notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    if (pendingReadIds.has(notificationId)) return;

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: true } : n))
    );
    setPendingReadIds((prev) => new Set(prev).add(notificationId));

    try {
      await markNotificationAsRead(notificationId);
      // Recompute unread count
      setNotifications((latest) => {
        const unread = latest.filter((n) => !n.isRead).length;
        onUnreadCountChange?.(unread);
        return latest;
      });
    } catch (err) {
      console.error('[Mark Read Error]:', err);
      // Rollback
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: false } : n))
      );
    } finally {
      setPendingReadIds((prev) => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  // Handle marking all notifications as read
  const handleMarkAllRead = async () => {
    if (isMarkingAllRead || unreadCount === 0) return;

    const previousNotifications = notifications;
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    onUnreadCountChange?.(0);
    setIsMarkingAllRead(true);

    try {
      await markAllNotificationsAsRead();
    } catch (err) {
      console.error('[Mark All Read Error]:', err);
      // Rollback
      setNotifications(previousNotifications);
      const prevUnread = previousNotifications.filter((n) => !n.isRead).length;
      onUnreadCountChange?.(prevUnread);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Guest State
  if (!isAuthenticated) {
    return (
      <div className="bg-white border border-[#dbdbdb] rounded-2xl p-8 text-center space-y-4 shadow-2xs">
        <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
          <Bell className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-gray-900">Notifications</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Log in to see who followed you, liked your thought cards, or joined discussions on your posts.
          </p>
        </div>
        {onNavigateLogin && (
          <Button size="sm" variant="primary" onClick={onNavigateLogin} leftIcon={<LogIn className="w-4 h-4" />}>
            Log In
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-white border border-[#dbdbdb] rounded-xl p-4 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-pink-600">
            <Heart className="w-4 h-4 fill-pink-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="text-[11px] font-bold bg-pink-500 text-white px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h2>
            <p className="text-[11px] text-gray-400 font-mono">(:User)-[:RECEIVES_NOTIFICATION]-&gt;(:Notification)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              size="xs"
              variant="outline"
              onClick={handleMarkAllRead}
              disabled={isMarkingAllRead}
              leftIcon={
                isMarkingAllRead ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                )
              }
            >
              Mark all read
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            onClick={loadNotifications}
            disabled={isLoading}
            aria-label="Refresh notifications"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="bg-white border border-[#dbdbdb] rounded-xl divide-y divide-gray-100 shadow-2xs">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-3.5 bg-gray-200 rounded w-48" />
                <div className="h-2.5 bg-gray-100 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white border border-[#dbdbdb] rounded-xl p-8 text-center space-y-3 shadow-2xs">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
          <h4 className="text-sm font-bold text-gray-900">Failed to Load Notifications</h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">{error}</p>
          <Button size="xs" variant="primary" onClick={loadNotifications} leftIcon={<RefreshCw className="w-3 h-3" />}>
            Retry
          </Button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white border border-[#dbdbdb] rounded-xl p-10 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
            <Bell className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-gray-900">No Notifications Yet</h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            When someone follows your graph account, likes your posts, or joins the conversation, updates will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#dbdbdb] rounded-xl divide-y divide-gray-100 shadow-2xs overflow-hidden">
          {notifications.map((notif) => {
            const isUnread = !notif.isRead;
            const isPending = pendingReadIds.has(notif.notificationId);

            // Icon for event type
            const renderTypeIcon = () => {
              switch (notif.type) {
                case 'like':
                  return <Heart className="w-3 h-3 text-pink-500 fill-pink-500" />;
                case 'comment':
                  return <MessageCircle className="w-3 h-3 text-purple-600 fill-purple-100" />;
                case 'follow':
                  return <UserPlus className="w-3 h-3 text-blue-600" />;
                default:
                  return <Bell className="w-3 h-3 text-gray-500" />;
              }
            };

            return (
              <div
                key={notif.notificationId}
                className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-colors ${
                  isUnread ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'bg-white hover:bg-gray-50/70'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Actor Avatar with event badge */}
                  <div className="relative shrink-0">
                    <Avatar
                      src={notif.actor?.avatarUrl}
                      alt={notif.actor?.fullName || notif.actor?.username || 'User'}
                      size="md"
                    />
                    <div className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow-2xs border border-gray-100 flex items-center justify-center">
                      {renderTypeIcon()}
                    </div>
                  </div>

                  {/* Notification Content */}
                  <div className="text-xs text-gray-800 leading-snug min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      {notif.actor ? (
                        <span
                          className="font-bold text-gray-900 cursor-pointer hover:underline"
                          onClick={() => onNavigateProfile?.(notif.actor!.userId)}
                        >
                          @{notif.actor.username}
                        </span>
                      ) : null}
                      <span className="text-gray-700">{notif.message}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 text-[11px] text-gray-400">
                      <span>{formatTimeAgo(notif.createdAt)}</span>
                      <span>·</span>
                      <span className="font-mono text-[10px] text-gray-300">#{notif.notificationId}</span>
                    </div>
                  </div>
                </div>

                {/* Right Action / Read Status */}
                <div className="flex items-center gap-2 shrink-0">
                  {notif.actor && notif.type === 'follow' && onNavigateProfile && (
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => onNavigateProfile(notif.actor!.userId)}
                      rightIcon={<ArrowRight className="w-3 h-3" />}
                    >
                      Profile
                    </Button>
                  )}

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(notif.notificationId)}
                      disabled={isPending}
                      className="p-1 rounded-full text-blue-500 hover:bg-blue-100 transition-colors"
                      title="Mark as read"
                      aria-label="Mark notification as read"
                    >
                      {isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
