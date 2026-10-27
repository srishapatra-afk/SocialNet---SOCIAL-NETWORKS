import React from 'react';
import { PlusCircle, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Posts Yet',
  description = 'Your graph feed is quiet right now. Follow more people or publish your first thought card to spark conversation!',
  actionText = 'Create a Post',
  onAction,
}) => {
  return (
    <div className="bg-white border border-[#dbdbdb] rounded-2xl p-8 sm:p-12 text-center space-y-4 shadow-2xs">
      <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px] flex items-center justify-center shadow-md shadow-pink-500/20">
        <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-pink-500" />
        </div>
      </div>

      <div className="space-y-1.5 max-w-sm mx-auto">
        <h3 className="text-base sm:text-lg font-bold text-gray-900">{title}</h3>
        <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>

      {onAction && (
        <div className="pt-2">
          <Button
            size="sm"
            onClick={onAction}
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
};
