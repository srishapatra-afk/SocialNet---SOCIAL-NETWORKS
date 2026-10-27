import React from 'react';
import { Plus } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Story, User } from '../../types';

export interface StoriesRowProps {
  currentUser: User;
  stories: Story[];
  onStoryClick?: (story: Story) => void;
  onAddStoryClick?: () => void;
}

export const StoriesRow: React.FC<StoriesRowProps> = ({
  currentUser,
  stories,
  onStoryClick,
  onAddStoryClick,
}) => {
  return (
    <div className="bg-white border border-[#dbdbdb] rounded-xl p-3.5 shadow-2xs overflow-x-auto scrollbar-none select-none">
      <div className="flex items-center gap-4 min-w-max px-1">
        {/* Current User Add Story */}
        <div
          className="flex flex-col items-center gap-1.5 cursor-pointer group"
          onClick={onAddStoryClick}
        >
          <div className="relative">
            <Avatar src={currentUser.avatarUrl} alt={currentUser.fullName} size="lg" />
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#0095f6] border-2 border-white flex items-center justify-center text-white transition-transform group-hover:scale-110">
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>
          <span className="text-xs text-gray-500 font-medium max-w-[64px] truncate">
            Your Story
          </span>
        </div>

        {/* Stories List */}
        {stories.map((story) => (
          <div
            key={story.storyId}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
            onClick={() => onStoryClick?.(story)}
          >
            <Avatar
              src={story.user.avatarUrl}
              alt={story.user.fullName}
              size="lg"
              hasStory={true}
              unseenStory={story.hasUnseen}
            />
            <span className="text-xs text-gray-700 font-medium max-w-[68px] truncate group-hover:text-black">
              {story.user.username}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
