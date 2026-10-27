import React from 'react';
import { Quote, Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface TypographyPostCardProps {
  content: string;
  theme?: 'sunset' | 'ocean' | 'emerald' | 'berry' | 'midnight' | 'amber';
  authorName: string;
  tags?: string[];
  className?: string;
}

const themeStyles = {
  sunset: {
    gradient: 'bg-gradient-to-br from-rose-500 via-pink-600 to-amber-500',
    quoteColor: 'text-amber-200/40',
    badge: 'bg-white/20 text-white',
  },
  ocean: {
    gradient: 'bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500',
    quoteColor: 'text-cyan-200/40',
    badge: 'bg-white/20 text-white',
  },
  emerald: {
    gradient: 'bg-gradient-to-br from-emerald-600 via-teal-700 to-green-500',
    quoteColor: 'text-emerald-200/40',
    badge: 'bg-white/20 text-white',
  },
  berry: {
    gradient: 'bg-gradient-to-br from-purple-700 via-fuchsia-600 to-pink-500',
    quoteColor: 'text-pink-200/40',
    badge: 'bg-white/20 text-white',
  },
  midnight: {
    gradient: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900',
    quoteColor: 'text-indigo-300/30',
    badge: 'bg-white/15 text-indigo-200',
  },
  amber: {
    gradient: 'bg-gradient-to-br from-amber-500 via-orange-600 to-yellow-500',
    quoteColor: 'text-yellow-200/40',
    badge: 'bg-white/20 text-white',
  },
};

export const TypographyPostCard: React.FC<TypographyPostCardProps> = ({
  content,
  theme = 'sunset',
  authorName,
  tags,
  className,
}) => {
  const currentTheme = themeStyles[theme] || themeStyles.sunset;

  // Truncate long content if necessary for card display
  const displayContent = content.length > 280 ? `${content.slice(0, 280)}...` : content;

  return (
    <div
      className={cn(
        'relative w-full aspect-square sm:aspect-[4/3] rounded-lg p-6 sm:p-8 flex flex-col justify-between text-white overflow-hidden shadow-inner select-none transition-transform duration-300',
        currentTheme.gradient,
        className
      )}
    >
      {/* Decorative background quote graphic */}
      <div className="absolute top-4 right-4 pointer-events-none opacity-40">
        <Quote className={cn('w-20 h-20 -rotate-12', currentTheme.quoteColor)} />
      </div>

      {/* Decorative gradient overlay ring */}
      <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />

      {/* Top Header Label */}
      <div className="relative z-10 flex items-center justify-between">
        <div
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md',
            currentTheme.badge
          )}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Thought Card</span>
        </div>
        <span className="text-xs font-medium opacity-80">@{authorName}</span>
      </div>

      {/* Central Statement */}
      <div className="relative z-10 my-auto py-4">
        <p className="text-lg sm:text-xl md:text-2xl font-bold leading-relaxed tracking-tight text-white drop-shadow-sm font-sans">
          "{displayContent}"
        </p>
      </div>

      {/* Footer Tags */}
      <div className="relative z-10 flex items-center gap-1.5 flex-wrap">
        {tags && tags.length > 0 ? (
          tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-md bg-black/20 text-white/90 backdrop-blur-xs font-medium"
            >
              #{tag}
            </span>
          ))
        ) : (
          <span className="text-xs text-white/70 italic">DBMS DA3 · SocialNet</span>
        )}
      </div>
    </div>
  );
};
