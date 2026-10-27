import React, { useState } from 'react';
import {
  Bookmark,
  Check,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Share2,
  ShieldCheck,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { TypographyPostCard } from '../ui/TypographyPostCard';
import { Post, User } from '../../types';
import { formatTimeAgo, formatNumberCompact } from '../../utils/cn';

export interface PostCardProps {
  post: Post;
  currentUser?: User;
  onLikeToggle: (postId: number) => void;
  onSaveToggle: (postId: number) => void;
  onAddComment: (postId: number, content: string) => Promise<void> | void;
  onDeleteComment?: (commentId: number, postId: number) => Promise<void> | void;
  onUserClick?: (user: User) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUser,
  onLikeToggle,
  onSaveToggle,
  onAddComment,
  onDeleteComment,
  onUserClick,
}) => {
  const [showAllComments, setShowAllComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);

  const handleLike = () => {
    setIsLikeAnimating(true);
    setTimeout(() => setIsLikeAnimating(false), 400);
    onLikeToggle(post.postId);
  };

  const handleShare = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = commentInput.trim();
    if (!text || isSubmittingComment) return;

    setIsSubmittingComment(true);
    setCommentError(null);
    try {
      await onAddComment(post.postId, text);
      setCommentInput('');
      setShowAllComments(true);
    } catch (err: any) {
      setCommentError(err.message || 'Failed to post comment.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const commentsList = post.comments || [];
  const visibleComments = showAllComments ? commentsList : commentsList.slice(-2);

  return (
    <article className="bg-white border border-[#dbdbdb] rounded-xl shadow-2xs overflow-hidden transition-all duration-200 hover:border-gray-300">
      {/* 1. Header: Author & Options */}
      <header className="flex items-center justify-between p-3.5 sm:px-4">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onUserClick?.(post.author)}
        >
          <Avatar
            src={post.author.avatarUrl}
            alt={post.author.fullName}
            size="sm"
            hasStory={true}
            unseenStory={false}
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-gray-900 group-hover:underline">
                {post.author.username}
              </span>
              {post.author.isVerified && (
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-50" />
              )}
              <span className="text-gray-300 text-xs">·</span>
              <span className="text-[11px] text-gray-400 font-medium">
                {formatTimeAgo(post.createdAt)}
              </span>
            </div>
            {post.author.bio && (
              <span className="text-[11px] text-gray-400 truncate max-w-[240px]">
                {post.author.fullName}
              </span>
            )}
          </div>
        </div>

        <button
          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="More options"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </header>

      {/* 2. Post Media / Typography Card Fallback */}
      <div className="relative w-full bg-black/5 select-none">
        {post.imageUrl ? (
          <div
            className="relative w-full aspect-square sm:aspect-[4/3] bg-black overflow-hidden flex items-center justify-center cursor-pointer group"
            onDoubleClick={handleLike}
          >
            <img
              src={post.imageUrl}
              alt={`Post by ${post.author.username}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
              loading="lazy"
            />
            {/* Pop-up heart animation on double tap */}
            {isLikeAnimating && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-ping">
                <Heart className="w-24 h-24 text-white fill-white drop-shadow-lg" />
              </div>
            )}
          </div>
        ) : (
          /* Decision 2: Typography Post Card for text-only posts */
          <div className="p-2 sm:p-3 bg-gray-50/50">
            <TypographyPostCard
              content={post.content}
              theme={post.gradientTheme || 'sunset'}
              authorName={post.author.username}
              tags={post.tags}
            />
          </div>
        )}
      </div>

      {/* 3. Actions Toolbar */}
      <div className="px-3.5 sm:px-4 pt-3 pb-2 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Like Button */}
            <button
              onClick={handleLike}
              className={`p-1 -ml-1 rounded-full transition-transform active:scale-125 focus:outline-none ${
                post.isLiked ? 'text-[#ed4956]' : 'text-gray-800 hover:text-gray-500'
              }`}
              aria-label={post.isLiked ? 'Unlike post' : 'Like post'}
            >
              <Heart
                className={`w-6 h-6 transition-all ${
                  post.isLiked ? 'fill-[#ed4956] scale-110' : ''
                } ${isLikeAnimating ? 'animate-bounce' : ''}`}
              />
            </button>

            {/* Comment Button */}
            <button
              onClick={() => setShowAllComments(!showAllComments)}
              className="p-1 rounded-full text-gray-800 hover:text-gray-500 transition-colors focus:outline-none"
              aria-label="View comments"
            >
              <MessageCircle className="w-6 h-6" />
            </button>

            {/* Share / Copy Link Button */}
            <button
              onClick={handleShare}
              className="p-1 rounded-full text-gray-800 hover:text-gray-500 transition-colors focus:outline-none relative"
              aria-label="Share post"
            >
              {isCopied ? (
                <Check className="w-6 h-6 text-emerald-500" />
              ) : (
                <Share2 className="w-6 h-6" />
              )}
              {isCopied && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-bold bg-black text-white rounded-md whitespace-nowrap shadow-md">
                  Link copied!
                </span>
              )}
            </button>
          </div>

          {/* Bookmark / Save Button */}
          <button
            onClick={() => onSaveToggle(post.postId)}
            className={`p-1 -mr-1 rounded-full transition-colors focus:outline-none ${
              post.isSaved ? 'text-black' : 'text-gray-800 hover:text-gray-500'
            }`}
            aria-label={post.isSaved ? 'Remove bookmark' : 'Bookmark post'}
          >
            <Bookmark className={`w-6 h-6 ${post.isSaved ? 'fill-black' : ''}`} />
          </button>
        </div>

        {/* 4. Likes Counter */}
        <div className="text-xs sm:text-sm font-bold text-gray-900">
          {formatNumberCompact(post.likeCount)} {post.likeCount === 1 ? 'like' : 'likes'}
        </div>

        {/* 5. Caption */}
        <div className="text-xs sm:text-sm text-gray-800 leading-relaxed">
          <span
            className="font-bold mr-1.5 text-gray-900 cursor-pointer hover:underline"
            onClick={() => onUserClick?.(post.author)}
          >
            {post.author.username}
          </span>
          {post.imageUrl ? (
            <span>
              {captionExpanded || post.content.length <= 120
                ? post.content
                : `${post.content.slice(0, 120)}... `}
              {post.content.length > 120 && (
                <button
                  onClick={() => setCaptionExpanded(!captionExpanded)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-semibold ml-1 inline"
                >
                  {captionExpanded ? 'less' : 'more'}
                </button>
              )}
            </span>
          ) : (
            <span className="text-gray-600 italic">shared a typography thought card</span>
          )}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs text-[#00376b] hover:text-[#0095f6] cursor-pointer font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 6. Comments Summary & List */}
        {commentsList.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {commentsList.length > 2 && (
              <button
                onClick={() => setShowAllComments(!showAllComments)}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium block"
              >
                {showAllComments
                  ? 'Hide comments'
                  : `View all ${commentsList.length} comments`}
              </button>
            )}

            <div className="space-y-1">
              {visibleComments.map((comment) => (
                <div
                  key={comment.commentId}
                  className="flex items-start justify-between text-xs text-gray-800 group py-0.5"
                >
                  <div className="leading-snug flex-1 mr-2">
                    <span
                      className="font-bold mr-1.5 text-gray-900 cursor-pointer hover:underline"
                      onClick={() => onUserClick?.(comment.author)}
                    >
                      {comment.author.username}
                    </span>
                    <span>{comment.content || (comment as any).text}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-gray-400">
                      {formatTimeAgo(comment.createdAt)}
                    </span>
                    {currentUser && currentUser.userId === comment.author.userId && onDeleteComment && (
                      <button
                        type="button"
                        onClick={() => onDeleteComment(comment.commentId, post.postId)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-0.5"
                        title="Delete your comment"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 7. Inline Comment Composer */}
      {commentError && (
        <div className="px-3.5 sm:px-4 py-1 text-[11px] text-red-600 bg-red-50 border-t border-red-100">
          {commentError}
        </div>
      )}
      <footer className="border-t border-gray-100 px-3.5 sm:px-4 py-2.5 bg-white">
        <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={commentInput}
            onChange={(e) => {
              setCommentInput(e.target.value);
              if (commentError) setCommentError(null);
            }}
            placeholder="Add a comment..."
            disabled={isSubmittingComment}
            className="flex-1 text-xs sm:text-sm bg-transparent placeholder:text-gray-400 text-gray-800 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!commentInput.trim() || isSubmittingComment}
            className="text-xs sm:text-sm font-bold text-[#0095f6] hover:text-[#1877f2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmittingComment ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0095f6]" />
            ) : (
              'Post'
            )}
          </button>
        </form>
      </footer>
    </article>
  );
};
