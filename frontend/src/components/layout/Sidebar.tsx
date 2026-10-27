import React from 'react';
import {
  Compass,
  Heart,
  Home,
  MessageCircle,
  PlusSquare,
  Search,
  User,
  Users,
  Calendar,
  Sparkles,
  LogOut,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { User as UserType } from '../../types';

export interface SidebarProps {
  currentUser: UserType | null;
  isAuthenticated: boolean;
  activeNav: string;
  onNavSelect: (nav: string) => void;
  onCreatePostClick: () => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onLogoutClick: () => void;
  unreadCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  isAuthenticated,
  activeNav,
  onNavSelect,
  onCreatePostClick,
  onLoginClick,
  onRegisterClick,
  onLogoutClick,
  unreadCount = 2,
}) => {
  const navItems = [
    { id: 'feed', icon: Home, label: 'Feed' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'explore', icon: Compass, label: 'Explore' },
    { id: 'messages', icon: MessageCircle, label: 'Messages', badge: isAuthenticated ? 3 : 0 },
    { id: 'notifications', icon: Heart, label: 'Notifications', badge: isAuthenticated ? unreadCount : 0 },
    { id: 'create', icon: PlusSquare, label: 'Create', isAction: true },
    { id: 'groups', icon: Users, label: 'Groups' },
    { id: 'events', icon: Calendar, label: 'Events' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 border-r border-[#dbdbdb] bg-white h-screen fixed left-0 top-0 p-4 lg:p-6 justify-between z-30 select-none">
      <div className="space-y-6">
        {/* Brand Logo */}
        <div className="px-2 pt-2">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavSelect('feed')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px] flex items-center justify-center shadow-sm shadow-pink-500/20">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-pink-600" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent leading-none">
                SocialNet
              </h1>
              <p className="text-[10px] font-semibold text-gray-400 tracking-wider uppercase mt-1">
                DBMS DA3 · Neo4j
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeNav === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.isAction) {
                    onCreatePostClick();
                  } else {
                    onNavSelect(item.id);
                  }
                }}
                className={cn(
                  'flex items-center justify-between w-full px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150 group relative',
                  isActive
                    ? 'font-bold text-gray-950 bg-gray-100/90 shadow-2xs'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                )}
              >
                <div className="flex items-center gap-4">
                  <Icon
                    className={cn(
                      'w-6 h-6 transition-transform group-hover:scale-110',
                      isActive ? 'stroke-[2.5px] text-black' : 'text-gray-600'
                    )}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && item.badge > 0 && (
                  <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full bg-pink-500 text-white shadow-2xs">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Footer: Authenticated vs Guest State */}
      <div className="pt-4 border-t border-gray-100">
        {isAuthenticated && currentUser ? (
          <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-gray-50 transition-colors">
            <button
              onClick={() => onNavSelect('profile')}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
            >
              <Avatar
                src={currentUser.avatarUrl}
                alt={currentUser.fullName}
                size="sm"
                isOnline={true}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-gray-900 truncate">
                    {currentUser.username}
                  </span>
                  {currentUser.isVerified && (
                    <span className="text-blue-500 text-[10px]">●</span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 truncate">{currentUser.fullName}</p>
              </div>
            </button>

            <button
              onClick={onLogoutClick}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Log out of session"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2 p-1">
            <Button
              size="sm"
              variant="primary"
              fullWidth
              onClick={onLoginClick}
              leftIcon={<LogIn className="w-3.5 h-3.5" />}
            >
              Log In
            </Button>
            <Button
              size="sm"
              variant="outline"
              fullWidth
              onClick={onRegisterClick}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Sign Up
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
};
