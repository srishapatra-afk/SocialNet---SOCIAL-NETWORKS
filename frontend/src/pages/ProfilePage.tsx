import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfile, Post, User } from '../types';
import { fetchUserProfile, fetchUserPosts, followUser, unfollowUser } from '../services/userService';
import { likePost, unlikePost, createComment, deleteComment } from '../services/postService';
import { PostCard } from '../components/feed/PostCard';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import {
  ShieldCheck,
  Grid,
  List,
  AlertCircle,
  Loader2,
  Calendar,
  Share2,
  Check,
  RefreshCw,
  ArrowLeft,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import { CURRENT_USER } from '../data/mockData';

export interface ProfilePageProps {
  userId?: number;
  onNavigateLogin?: () => void;
  onNavigateBack?: () => void;
  onNavigateProfile?: (userId: number) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  userId,
  onNavigateLogin,
  onNavigateBack,
  onNavigateProfile,
}) => {
  const { currentUser: authUser, isAuthenticated, logout } = useAuth();
  
  // Default to authenticated user's ID, or fallback to demo account 101
  const targetUserId = userId || authUser?.userId || 101;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPostsLoading, setIsPostsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowPending, setIsFollowPending] = useState<boolean>(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [isShareCopied, setIsShareCopied] = useState<boolean>(false);
  const [pendingLikeIds, setPendingLikeIds] = useState<Set<number>>(new Set());

  // Active logged-in user representation for PostCard
  const activeUser: User = authUser
    ? {
        userId: authUser.userId,
        username: authUser.username,
        fullName: `${authUser.firstName} ${authUser.lastName}`,
        avatarUrl:
          authUser.avatarUrl ||
          (authUser.userId === 101
            ? CURRENT_USER.avatarUrl
            : `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80`),
        bio: authUser.bio || 'SocialNet Community Member',
        isVerified: true,
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
      }
    : CURRENT_USER;

  // Load profile and user posts
  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUserProfile(targetUserId);
      setProfile(data);
    } catch (err: any) {
      console.error('[Load Profile Error]:', err);
      setError(err.response?.data?.error || 'Failed to load user profile. The user may not exist.');
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId]);

  const loadPosts = useCallback(async () => {
    setIsPostsLoading(true);
    try {
      const data = await fetchUserPosts(targetUserId);
      setPosts(data.posts || []);
    } catch (err: any) {
      console.error('[Load User Posts Error]:', err);
      // Non-fatal if posts fail, profile can still display
    } finally {
      setIsPostsLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    loadProfile();
    loadPosts();
  }, [loadProfile, loadPosts]);

  // Handle follow / unfollow toggle
  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      if (onNavigateLogin) {
        onNavigateLogin();
      }
      return;
    }

    if (!profile || isFollowPending || profile.isOwnProfile) return;

    const previousIsFollowing = Boolean(profile.isFollowing);
    const previousFollowerCount = profile.followerCount;
    const nextIsFollowing = !previousIsFollowing;
    const nextFollowerCount = nextIsFollowing
      ? previousFollowerCount + 1
      : Math.max(0, previousFollowerCount - 1);

    // 1. Optimistic UI update
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            isFollowing: nextIsFollowing,
            followerCount: nextFollowerCount,
          }
        : null
    );

    setIsFollowPending(true);
    setFollowError(null);

    try {
      if (nextIsFollowing) {
        const res = await followUser(profile.userId);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                isFollowing: res.isFollowing,
                followerCount: res.followerCount,
                followingCount: res.followingCount,
              }
            : null
        );
      } else {
        const res = await unfollowUser(profile.userId);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                isFollowing: res.isFollowing,
                followerCount: res.followerCount,
                followingCount: res.followingCount,
              }
            : null
        );
      }
    } catch (err: any) {
      console.error('[Follow/Unfollow Error]:', err);
      // 2. Rollback on failure
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: previousIsFollowing,
              followerCount: previousFollowerCount,
            }
          : null
      );
      setFollowError(err.response?.data?.error || 'Failed to update follow status. Please try again.');
    } finally {
      setIsFollowPending(false);
    }
  };

  // Like / Unlike on profile post
  const handleLikeToggle = async (postId: number) => {
    if (!isAuthenticated) {
      if (onNavigateLogin) onNavigateLogin();
      return;
    }
    if (pendingLikeIds.has(postId)) return;

    const targetPost = posts.find((p) => p.postId === postId);
    if (!targetPost) return;

    const wasLiked = targetPost.isLiked;
    const previousLikeCount = targetPost.likeCount;
    const optimisticIsLiked = !wasLiked;
    const optimisticLikeCount = optimisticIsLiked
      ? previousLikeCount + 1
      : Math.max(0, previousLikeCount - 1);

    setPosts((prev) =>
      prev.map((p) =>
        p.postId === postId
          ? { ...p, isLiked: optimisticIsLiked, likeCount: optimisticLikeCount }
          : p
      )
    );

    setPendingLikeIds((prev) => new Set(prev).add(postId));

    try {
      const result = wasLiked ? await unlikePost(postId) : await likePost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.postId === postId
            ? { ...p, isLiked: result.isLiked, likeCount: result.likeCount }
            : p
        )
      );
    } catch (err) {
      console.error('[Like Error on Profile]:', err);
      // Rollback
      setPosts((prev) =>
        prev.map((p) =>
          p.postId === postId
            ? { ...p, isLiked: wasLiked, likeCount: previousLikeCount }
            : p
        )
      );
    } finally {
      setPendingLikeIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  // Add Comment on profile post
  const handleAddComment = async (postId: number, content: string) => {
    if (!isAuthenticated) {
      if (onNavigateLogin) onNavigateLogin();
      throw new Error('Please log in to comment.');
    }

    try {
      const createdComment = await createComment(postId, content);
      setPosts((prev) =>
        prev.map((p) => {
          if (p.postId === postId) {
            return {
              ...p,
              commentCount: p.commentCount + 1,
              comments: [...(p.comments || []), createdComment],
            };
          }
          return p;
        })
      );
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to post comment.';
      throw new Error(msg);
    }
  };

  // Delete Comment on profile post
  const handleDeleteComment = async (commentId: number, postId: number) => {
    if (!isAuthenticated) return;
    try {
      await deleteComment(commentId);
      setPosts((prev) =>
        prev.map((p) => {
          if (p.postId === postId) {
            return {
              ...p,
              commentCount: Math.max(0, p.commentCount - 1),
              comments: (p.comments || []).filter((c) => c.commentId !== commentId),
            };
          }
          return p;
        })
      );
    } catch (err: any) {
      console.error('[Delete Comment Error]:', err);
    }
  };

  // Copy share profile link
  const handleShareProfile = () => {
    setIsShareCopied(true);
    setTimeout(() => setIsShareCopied(false), 2000);
  };

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="bg-white border border-[#dbdbdb] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xs animate-pulse">
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gray-200 shrink-0" />
          <div className="space-y-3 flex-1 w-full text-center sm:text-left">
            <div className="h-6 bg-gray-200 rounded w-48 mx-auto sm:mx-0" />
            <div className="h-4 bg-gray-100 rounded w-64 mx-auto sm:mx-0" />
            <div className="flex justify-center sm:justify-start gap-6 pt-2">
              <div className="h-4 bg-gray-200 rounded w-16" />
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !profile) {
    return (
      <div className="bg-white border border-[#dbdbdb] rounded-2xl p-8 text-center space-y-4 shadow-2xs">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-500">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-gray-900">User Profile Unavailable</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">{error || 'Unable to load profile data.'}</p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          {onNavigateBack && (
            <Button size="sm" variant="outline" onClick={onNavigateBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={loadProfile} leftIcon={<RefreshCw className="w-4 h-4" />}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const isSelf = profile.isOwnProfile || (authUser && authUser.userId === profile.userId);

  return (
    <div className="space-y-6">
      {/* Navigation Header if back button is available */}
      {onNavigateBack && (
        <div className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors cursor-pointer" onClick={onNavigateBack}>
          <ArrowLeft className="w-4 h-4" />
          <span className="font-semibold">Back to Feed</span>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-white border border-[#dbdbdb] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xs relative">
        {followError && (
          <div className="absolute top-3 left-6 right-6 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{followError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 text-center sm:text-left pt-2">
          <Avatar
            src={profile.avatarUrl}
            alt={profile.fullName}
            size="2xl"
            hasStory={true}
            unseenStory={!profile.isFollowing && !isSelf}
          />

          <div className="space-y-3.5 flex-1 min-w-0">
            {/* Top row: Username & Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 truncate">@{profile.username}</h2>
                {profile.isVerified && (
                  <span title="Verified Graph Node">
                    <ShieldCheck className="w-5 h-5 text-blue-500 fill-blue-50 shrink-0" />
                  </span>
                )}
                <span className="text-[11px] font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                  #{profile.userId}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center sm:justify-start gap-2">
                {isSelf ? (
                  <>
                    <Button size="xs" variant="secondary">
                      Edit Profile
                    </Button>
                    <Button size="xs" variant="outline" onClick={logout}>
                      Log Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="xs"
                      variant={profile.isFollowing ? 'outline' : 'primary'}
                      onClick={handleFollowToggle}
                      disabled={isFollowPending}
                      leftIcon={
                        isFollowPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : profile.isFollowing ? (
                          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )
                      }
                    >
                      {isFollowPending
                        ? 'Updating...'
                        : profile.isFollowing
                        ? 'Following'
                        : 'Follow'}
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={handleShareProfile}
                      leftIcon={isShareCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                    >
                      {isShareCopied ? 'Copied' : 'Share'}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-center sm:justify-start gap-7 text-xs sm:text-sm">
              <div>
                <span className="font-bold text-gray-900 mr-1.5">{profile.postCount}</span>
                <span className="text-gray-500">posts</span>
              </div>
              <div>
                <span className="font-bold text-gray-900 mr-1.5">{profile.followerCount}</span>
                <span className="text-gray-500">followers</span>
              </div>
              <div>
                <span className="font-bold text-gray-900 mr-1.5">{profile.followingCount}</span>
                <span className="text-gray-500">following</span>
              </div>
            </div>

            {/* Bio & Details */}
            <div className="text-xs sm:text-sm space-y-1">
              <p className="font-bold text-gray-900">{profile.fullName}</p>
              <p className="text-gray-600 leading-relaxed max-w-lg">{profile.bio}</p>
              <div className="flex items-center justify-center sm:justify-start gap-4 text-[11px] text-gray-400 pt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Active Neo4j Graph Citizen
                </span>
                <span>·</span>
                <span className="text-purple-600 font-semibold">
                  {profile.isFollowing ? 'Connected via :FOLLOWS' : isSelf ? 'Your Account' : 'Not Connected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Posts Section */}
      <div className="space-y-4">
        {/* Tab & View Mode Controls */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Posts ({posts.length})
            </h3>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white shadow-2xs text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Grid View"
              aria-label="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow-2xs text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="List View"
              aria-label="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Posts Content */}
        {isPostsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white border border-[#dbdbdb] rounded-2xl p-10 text-center space-y-2 shadow-2xs">
            <Grid className="w-10 h-10 mx-auto text-gray-300" />
            <h4 className="text-sm font-bold text-gray-900">No Posts Yet</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              When @{profile.username} shares thoughts or photos with the graph community, they will appear here.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {posts.map((post) => (
              <div
                key={post.postId}
                className="relative aspect-square rounded-xl overflow-hidden bg-gray-900 group cursor-pointer shadow-2xs transition-transform duration-200 hover:scale-[1.01]"
                onClick={() => setViewMode('list')}
              >
                {post.imageUrl ? (
                  <img src={post.imageUrl} alt={post.content} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full p-4 bg-gradient-to-br from-indigo-500 to-purple-700 text-white flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">#{post.postId}</span>
                    <p className="text-xs font-medium line-clamp-3 leading-snug">{post.content}</p>
                    <span className="text-[9px] opacity-75">{post.createdAt.split('T')[0]}</span>
                  </div>
                )}
                {/* Hover overlay with like & comment counts */}
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-4">
                  <span>❤️ {post.likeCount}</span>
                  <span>💬 {post.commentCount}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.postId}
                post={post}
                currentUser={activeUser}
                onLikeToggle={handleLikeToggle}
                onSaveToggle={() => {}}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                onUserClick={(u) => onNavigateProfile?.(u.userId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
