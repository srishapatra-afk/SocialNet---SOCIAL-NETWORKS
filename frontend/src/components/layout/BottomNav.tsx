import React from 'react';
import { Compass, Home, PlusSquare, Search } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Avatar } from '../ui/Avatar';
import { User as UserType } from '../../types';

export interface BottomNavProps {
  currentUser: UserType;
  activeNav: string;
  onNavSelect: (nav: string) => void;
  onCreatePostClick: () => void;
  className?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentUser,
  activeNav,
  onNavSelect,
  onCreatePostClick,
  className,
}) => {
  return (
    <nav
      className={cn(
        'md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#dbdbdb] px-6 py-2 flex items-center justify-between shadow-lg',
        className
      )}
    >
      <button
        onClick={() => onNavSelect('feed')}
        className={cn(
          'p-2 rounded-xl transition-colors',
          activeNav === 'feed' ? 'text-black' : 'text-gray-500 hover:text-black'
        )}
        aria-label="Feed"
      >
        <Home className={cn('w-6 h-6', activeNav === 'feed' && 'stroke-[2.5px]')} />
      </button>

      <button
        onClick={() => onNavSelect('explore')}
        className={cn(
          'p-2 rounded-xl transition-colors',
          activeNav === 'explore' ? 'text-black' : 'text-gray-500 hover:text-black'
        )}
        aria-label="Explore"
      >
        <Compass className={cn('w-6 h-6', activeNav === 'explore' && 'stroke-[2.5px]')} />
      </button>

      {/* Center Create Action */}
      <button
        onClick={onCreatePostClick}
        className="p-1.5 rounded-xl text-black hover:scale-105 active:scale-95 transition-transform"
        aria-label="Create Post"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-sm shadow-pink-500/30">
          <PlusSquare className="w-5 h-5" />
        </div>
      </button>

      <button
        onClick={() => onNavSelect('search')}
        className={cn(
          'p-2 rounded-xl transition-colors',
          activeNav === 'search' ? 'text-black' : 'text-gray-500 hover:text-black'
        )}
        aria-label="Search"
      >
        <Search className={cn('w-6 h-6', activeNav === 'search' && 'stroke-[2.5px]')} />
      </button>

      <button
        onClick={() => onNavSelect('profile')}
        className={cn(
          'p-1 rounded-full transition-transform',
          activeNav === 'profile' && 'ring-2 ring-black'
        )}
        aria-label="Profile"
      >
        <Avatar src={currentUser.avatarUrl} alt={currentUser.fullName} size="xs" />
      </button>
    </nav>
  );
};
