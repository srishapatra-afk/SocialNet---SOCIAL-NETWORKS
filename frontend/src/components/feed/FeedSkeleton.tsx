import React from 'react';

export const FeedSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="bg-white border border-[#dbdbdb] rounded-xl p-4 shadow-2xs space-y-4"
        >
          {/* Header Skeleton */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-200" />
            <div className="space-y-1.5 flex-1">
              <div className="w-28 h-3.5 bg-gray-200 rounded-sm" />
              <div className="w-20 h-2.5 bg-gray-100 rounded-sm" />
            </div>
          </div>

          {/* Media Body Skeleton */}
          <div className="w-full aspect-[4/3] bg-gray-100 rounded-lg" />

          {/* Actions & Caption Skeleton */}
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div className="w-6 h-6 rounded-md bg-gray-200" />
              <div className="w-6 h-6 rounded-md bg-gray-200" />
              <div className="w-6 h-6 rounded-md bg-gray-200" />
            </div>
            <div className="w-24 h-3 bg-gray-200 rounded-sm" />
            <div className="w-full h-3 bg-gray-100 rounded-sm" />
            <div className="w-3/4 h-3 bg-gray-100 rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
};
