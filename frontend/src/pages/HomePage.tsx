import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StoriesRow } from '../components/feed/StoriesRow';
import { PostComposer } from '../components/feed/PostComposer';
import { PostCard } from '../components/feed/PostCard';
import { FeedFilter } from '../components/feed/FeedFilter';
import { FeedSkeleton } from '../components/feed/FeedSkeleton';
import { EmptyState } from '../components/feed/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { CURRENT_USER, MOCK_STORIES, MOCK_POSTS } from '../data/mockData';
import { Post, User, Story, FeedFilterType } from '../types';
import { ShieldCheck, RefreshCw, AlertCircle, Database, Lock } from 'lucide-react';
import { fetchPosts, likePost, unlikePost, createComment, deleteComment } from '../services/postService';
import { useAuth } from '../context/AuthContext';

export interface HomePageProps {
  isCreateModalOpen: boolean;
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
  onNavigateLogin?: () => void;
  onNavigateProfile?: (userId: number) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  isCreateModalOpen,
  onCloseCreateModal,
  onOpenCreateModal,
  onNavigateLogin,
  onNavigateProfile,
}) => {
  const { currentUser: authUser, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);
  const [currentFilter, setCurrentFilter] = useState<FeedFilterType>('for-you');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);

  // Active current user representation (dynamic from auth session, fallback to guest)
  const activeUser: User = authUser
    ? {
        userId: authUser.userId,
        username: authUser.username,
        fullName: `${authUser.firstName} ${authUser.lastName}`,
        avatarUrl:
          authUser.avatarUrl ||
          (authUser.userId === 101
            ? CURRENT_USER.avatarUrl
            : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'),
        bio: authUser.bio || `@${authUser.username} on SocialNet Neo4j Network`,
        isVerified: true,
        followerCount: authUser.userId === 101 ? 342 : 10,
        followingCount: authUser.userId === 101 ? 189 : 5,
        postCount: authUser.userId === 101 ? 14 : 0,
      }
    : CURRENT_USER;

  // Real-time API fetch from Neo4j Aura backend
  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const response = await fetchPosts(1, 20);
      if (response?.status === 'success' && response.data?.posts) {
        setPosts(response.data.posts);
        setIsLiveApi(true);
      } else {
        throw new Error('Unexpected response shape from feed API');
      }
    } catch (err: any) {
      console.warn('[Feed]: Live API fetch failed:', err);
      const msg =
        err.response?.data?.error || err.message || 'Unable to connect to Neo4j graph API.';
      setApiError(msg);
      setIsLiveApi(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Fallback to isolated mock data strictly on user demand if offline
  const handleLoadMockFallback = () => {
    setPosts(MOCK_POSTS);
    setApiError(null);
    setIsLiveApi(false);
  };

  // Filter posts according to active tab
  const filteredPosts = useMemo(() => {
    if (showEmptyState) return [];

    switch (currentFilter) {
      case 'following':
        return posts.filter(
          (p) =>
            p.author.isFollowing ||
            p.author.userId === activeUser.userId ||
            p.author.userId === 102
        );
      case 'text-only':
        return posts.filter((p) => !p.imageUrl);
      case 'media':
        return posts.filter((p) => !!p.imageUrl);
      case 'for-you':
      default:
        return posts;
    }
  }, [posts, currentFilter, showEmptyState, activeUser.userId]);

  // Post creation handler: prepends newly created post from Neo4j Aura to feed state
  const handlePostCreated = (newPost: Post) => {
    setPosts((prevPosts) => [newPost, ...prevPosts]);
  };

  const [pendingLikeIds, setPendingLikeIds] = useState<Set<number>>(new Set());

  // Toggle Like on a post with optimistic update and rollback on failure
  const handleLikeToggle = async (postId: number) => {
    // 1. If not authenticated, prompt login and return
    if (!isAuthenticated) {
      if (onNavigateLogin) {
        onNavigateLogin();
      }
      return;
    }

    // 2. Prevent concurrent duplicate requests for the same post while inflight
    if (pendingLikeIds.has(postId)) {
      return;
    }

    // 3. Find current post state
    const targetPost = posts.find((p) => p.postId === postId);
    if (!targetPost) return;

    const wasLiked = targetPost.isLiked;
    const previousLikeCount = targetPost.likeCount;
    const nextIsLiked = !wasLiked;
    const nextLikeCount = nextIsLiked ? previousLikeCount + 1 : Math.max(0, previousLikeCount - 1);

    // 4. Optimistic UI update
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.postId === postId
          ? {
              ...post,
              isLiked: nextIsLiked,
              likeCount: nextLikeCount,
            }
          : post
      )
    );

    // 5. Mark pending
    setPendingLikeIds((prev) => new Set(prev).add(postId));

    try {
      // 6. Network request to backend API (PUT to like, DELETE to unlike)
      const result = wasLiked ? await unlikePost(postId) : await likePost(postId);

      // Reconcile with exact server confirmed state
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.postId === postId
            ? {
                ...post,
                isLiked: result.isLiked,
                likeCount: result.likeCount,
              }
            : post
        )
      );
    } catch (err) {
      console.error('[Like Toggle Error]: Failed to persist like status to Neo4j:', err);
      // 7. Rollback on failure
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.postId === postId
            ? {
                ...post,
                isLiked: wasLiked,
                likeCount: previousLikeCount,
              }
            : post
        )
      );
    } finally {
      // Unmark pending
      setPendingLikeIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  // Toggle Bookmark / Save
  const handleSaveToggle = (postId: number) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.postId === postId ? { ...post, isSaved: !post.isSaved } : post
      )
    );
  };

  // Add a comment to a post with confirmed backend insertion
  const handleAddComment = async (postId: number, content: string) => {
    if (!isAuthenticated) {
      if (onNavigateLogin) {
        onNavigateLogin();
      }
      throw new Error('Please log in to comment.');
    }

    try {
      const createdComment = await createComment(postId, content);
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.postId === postId) {
            return {
              ...post,
              commentCount: post.commentCount + 1,
              comments: [...(post.comments || []), createdComment],
            };
          }
          return post;
        })
      );
    } catch (err: any) {
      console.error('[Add Comment Error]:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to post comment.';
      throw new Error(msg);
    }
  };

  // Delete a comment with confirmed backend removal
  const handleDeleteComment = async (commentId: number, postId: number) => {
    if (!isAuthenticated) return;

    try {
      await deleteComment(commentId);
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.postId === postId) {
            return {
              ...post,
              commentCount: Math.max(0, post.commentCount - 1),
              comments: (post.comments || []).filter((c) => c.commentId !== commentId),
            };
          }
          return post;
        })
      );
    } catch (err: any) {
      console.error('[Delete Comment Error]:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to delete comment.';
      alert(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Live Database Connection Indicator */}
      <div className="flex items-center justify-between px-1">
        {isLiveApi ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Live Neo4j Aura Graph Feed ({posts.length} posts loaded)</span>
          </div>
        ) : apiError ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-medium text-red-700">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            <span>Feed Connection Error</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800">
            <span>Offline Mock Mode</span>
          </div>
        )}

        <button
          onClick={loadPosts}
          disabled={isLoading}
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-black transition-colors disabled:opacity-50"
          title="Refresh feed from Neo4j"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Stories Carousel Bar */}
      <StoriesRow
        currentUser={activeUser}
        stories={MOCK_STORIES}
        onStoryClick={(story) => setSelectedStory(story)}
        onAddStoryClick={onOpenCreateModal}
      />

      {/* 3. Post Composer (Enabled if authenticated, prompt to login if guest) */}
      {isAuthenticated ? (
        <PostComposer
          currentUser={activeUser}
          onPostCreated={handlePostCreated}
        />
      ) : (
        <div className="bg-white border border-[#dbdbdb] rounded-xl p-4 text-center space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-800">
            <Lock className="w-4 h-4 text-gray-400" />
            <span>Want to share a thought with the graph?</span>
          </div>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Log in to compose posts, save favorites, and participate in graph discussions.
          </p>
          <Button size="xs" variant="primary" onClick={onNavigateLogin}>
            Log In to Post
          </Button>
        </div>
      )}

      {/* 4. Feed Filter Controls */}
      <FeedFilter
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        postCount={filteredPosts.length}
        showSkeleton={showSkeleton}
        onToggleSkeleton={() => setShowSkeleton(!showSkeleton)}
        showEmptyState={showEmptyState}
        onToggleEmptyState={() => setShowEmptyState(!showEmptyState)}
      />

      {/* 5. Error State Banner (with retry and optional offline mock fallback) */}
      {apiError && !isLoading && posts.length === 0 && (
        <div className="bg-white border border-red-200 rounded-2xl p-6 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-500">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-900">Failed to Retrieve Feed</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">{apiError}</p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button size="sm" onClick={loadPosts} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Retry Connection
            </Button>
            <Button size="sm" variant="outline" onClick={handleLoadMockFallback}>
              View Mock Data Fallback
            </Button>
          </div>
        </div>
      )}

      {/* 6. Feed Content: Loading vs Empty vs Posts List */}
      {isLoading || showSkeleton ? (
        <FeedSkeleton />
      ) : filteredPosts.length === 0 ? (
        <EmptyState
          title={
            currentFilter === 'following'
              ? 'No Following Posts'
              : currentFilter === 'text-only'
              ? 'No Thought Cards Found'
              : 'Graph Feed is Empty'
          }
          description="No posts found matching the current criteria. Connect with more researchers or publish your first graph insight!"
          actionText={isAuthenticated ? 'Create Post' : 'Log In to Create'}
          onAction={isAuthenticated ? onOpenCreateModal : onNavigateLogin}
        />
      ) : (
        <div className="space-y-6">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.postId}
              post={post}
              currentUser={activeUser}
              onLikeToggle={handleLikeToggle}
              onSaveToggle={handleSaveToggle}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onUserClick={(user) => {
                if (onNavigateProfile) {
                  onNavigateProfile(user.userId);
                } else {
                  setSelectedUser(user);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Modal: Create Post (Launched from Navigation) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={onCloseCreateModal}
        title="Create New Post"
        maxWidth="lg"
      >
        <PostComposer
          currentUser={activeUser}
          onPostCreated={handlePostCreated}
          isModal={true}
          onCloseModal={onCloseCreateModal}
        />
      </Modal>

      {/* Modal: User Quick Preview */}
      {selectedUser && (
        <Modal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title={`@${selectedUser.username}`}
          maxWidth="md"
        >
          <div className="space-y-5 text-center">
            <div className="flex justify-center">
              <Avatar
                src={selectedUser.avatarUrl}
                alt={selectedUser.fullName}
                size="2xl"
                hasStory={true}
                unseenStory={true}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1.5">
                <h4 className="text-lg font-bold text-gray-900">{selectedUser.fullName}</h4>
                {selectedUser.isVerified && (
                  <ShieldCheck className="w-4 h-4 text-blue-500 fill-blue-50" />
                )}
              </div>
              <p className="text-xs text-gray-400">User ID: #{selectedUser.userId}</p>
              {selectedUser.bio && (
                <p className="text-xs text-gray-600 max-w-xs mx-auto leading-relaxed pt-1">
                  {selectedUser.bio}
                </p>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-center gap-6 py-3 border-y border-gray-100 text-xs">
              <div>
                <span className="font-bold text-gray-900 block text-sm">
                  {selectedUser.postCount}
                </span>
                <span className="text-gray-400">posts</span>
              </div>
              <div>
                <span className="font-bold text-gray-900 block text-sm">
                  {selectedUser.followerCount}
                </span>
                <span className="text-gray-400">followers</span>
              </div>
              <div>
                <span className="font-bold text-gray-900 block text-sm">
                  {selectedUser.followingCount}
                </span>
                <span className="text-gray-400">following</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              {onNavigateProfile && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    const uId = selectedUser.userId;
                    setSelectedUser(null);
                    onNavigateProfile(uId);
                  }}
                >
                  View Profile
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Story Quick Viewer */}
      {selectedStory && (
        <Modal
          isOpen={!!selectedStory}
          onClose={() => setSelectedStory(null)}
          title={`${selectedStory.user.username}'s Story`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-center">
            <div className="relative aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
              {selectedStory.previewImageUrl ? (
                <img
                  src={selectedStory.previewImageUrl}
                  alt="Story preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="p-6 text-white text-center">
                  <p className="text-sm font-semibold">Graph Story by @{selectedStory.user.username}</p>
                </div>
              )}
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-xs">
                <Avatar src={selectedStory.user.avatarUrl} alt={selectedStory.user.fullName} size="xs" />
                <span className="font-bold">{selectedStory.user.username}</span>
              </div>
            </div>
            <Button size="sm" fullWidth variant="secondary" onClick={() => setSelectedStory(null)}>
              Close Story
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
