import React from 'react';
import { Heart, LogIn, MessageCircle, Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface HeaderProps {
  isAuthenticated?: boolean;
  onNotificationClick?: () => void;
  onMessageClick?: () => void;
  onLoginClick?: () => void;
  unreadCount?: number;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  isAuthenticated = false,
  onNotificationClick,
  onMessageClick,
  onLoginClick,
  unreadCount = 2,
  className,
}) => {
  return (
    <header
      className={cn(
        'md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#dbdbdb] px-4 py-2.5 flex items-center justify-between shadow-2xs',
        className
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[1.5px] flex items-center justify-center">
          <div className="w-full h-full bg-white rounded-[7px] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-pink-600" />
          </div>
        </div>
        <span className="text-lg font-black tracking-tight bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
          SocialNet
        </span>
      </div>

      {/* Quick Action Icons */}
      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <>
            <button
              onClick={onNotificationClick}
              className="relative p-2 text-gray-700 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Notifications"
            >
              <Heart className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-pink-500 rounded-full ring-2 ring-white" />
              )}
            </button>

            <button
              onClick={onMessageClick}
              className="relative p-2 text-gray-700 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Direct Messages"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </>
        ) : (
          <button
            onClick={onLoginClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0095f6] hover:bg-[#1877f2] transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In</span>
          </button>
        )}
      </div>
    </header>
  );
};
