import React, { useState } from 'react';
import { cn } from '../../utils/cn';

export interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  hasStory?: boolean;
  unseenStory?: boolean;
  isOnline?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeMap = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-18 h-18 text-lg',
  '2xl': 'w-24 h-24 text-2xl',
};

const ringPaddingMap = {
  xs: 'p-[1.5px]',
  sm: 'p-[2px]',
  md: 'p-[2px]',
  lg: 'p-[3px]',
  xl: 'p-[3px]',
  '2xl': 'p-[4px]',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  size = 'md',
  hasStory = false,
  unseenStory = false,
  isOnline = false,
  className,
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);

  // Derive initials from alt string
  const initials = alt
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('') || '?';

  // Deterministic pastel background for initials fallback
  const getFallbackBg = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-indigo-500 to-purple-600',
      'bg-gradient-to-br from-pink-500 to-rose-600',
      'bg-gradient-to-br from-blue-500 to-cyan-600',
      'bg-gradient-to-br from-amber-500 to-orange-600',
      'bg-gradient-to-br from-emerald-500 to-teal-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const avatarElement = (
    <div
      className={cn(
        'relative rounded-full overflow-hidden flex items-center justify-center font-semibold text-white select-none shrink-0 transition-transform duration-200',
        sizeMap[size],
        imageError || !src ? getFallbackBg(alt) : 'bg-gray-100',
        onClick && 'cursor-pointer hover:scale-105 active:scale-95'
      )}
      onClick={onClick}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );

  if (hasStory) {
    return (
      <div className={cn('relative inline-flex items-center justify-center shrink-0', className)}>
        <div
          className={cn(
            'rounded-full transition-transform duration-200',
            ringPaddingMap[size],
            unseenStory
              ? 'bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 animate-gradient'
              : 'bg-gray-300',
            onClick && 'cursor-pointer hover:scale-105 active:scale-95'
          )}
        >
          <div className="bg-white rounded-full p-[2px]">{avatarElement}</div>
        </div>
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
        )}
      </div>
    );
  }

  return (
    <div className={cn('relative inline-flex items-center justify-center shrink-0', className)}>
      {avatarElement}
      {isOnline && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
      )}
    </div>
  );
};
