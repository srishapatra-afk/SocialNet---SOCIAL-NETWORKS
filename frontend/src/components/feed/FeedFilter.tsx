import React from 'react';
import { Eye, EyeOff, Filter, Image, Sparkles, UserCheck } from 'lucide-react';
import { FeedFilterType } from '../../types';

export interface FeedFilterProps {
  currentFilter: FeedFilterType;
  onFilterChange: (filter: FeedFilterType) => void;
  postCount: number;
  showSkeleton: boolean;
  onToggleSkeleton: () => void;
  showEmptyState: boolean;
  onToggleEmptyState: () => void;
}

export const FeedFilter: React.FC<FeedFilterProps> = ({
  currentFilter,
  onFilterChange,
  postCount,
  showSkeleton,
  onToggleSkeleton,
  showEmptyState,
  onToggleEmptyState,
}) => {
  const filters: { id: FeedFilterType; label: string; icon: React.ReactNode }[] = [
    { id: 'for-you', label: 'For You', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'following', label: 'Following', icon: <UserCheck className="w-3.5 h-3.5" /> },
    { id: 'text-only', label: 'Thought Cards', icon: <Filter className="w-3.5 h-3.5" /> },
    { id: 'media', label: 'Media', icon: <Image className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="bg-white border border-[#dbdbdb] rounded-xl p-3 shadow-2xs space-y-2.5">
      <div className="flex items-center justify-between">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {filters.map((f) => {
            const isActive = currentFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => onFilterChange(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-black text-white shadow-2xs'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-black'
                }`}
              >
                {f.icon}
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>

        {/* Count Indicator */}
        <span className="text-[11px] font-bold text-gray-400 shrink-0 hidden sm:inline">
          {postCount} {postCount === 1 ? 'post' : 'posts'}
        </span>
      </div>

      {/* State Preview Switches (Allows reviewer/user to inspect loading skeleton & empty state) */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500">
        <span className="font-medium text-gray-400">UI State Previews:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSkeleton}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-colors ${
              showSkeleton
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {showSkeleton ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span>Skeleton</span>
          </button>

          <button
            onClick={onToggleEmptyState}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-colors ${
              showEmptyState
                ? 'bg-purple-100 text-purple-800 border-purple-300'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {showEmptyState ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span>Empty State</span>
          </button>
        </div>
      </div>
    </div>
  );
};
