import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search as SearchIcon,
  X,
  Users,
  FileText,
  Layers,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
  UserPlus,
  UserCheck,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { User, SearchFilterType, SearchResults } from '../types';
import { executeSearch } from '../services/searchService';
import { followUser, unfollowUser } from '../services/userService';
import { likePost, unlikePost, createComment, deleteComment } from '../services/postService';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PostCard } from '../components/feed/PostCard';
import { formatNumberCompact } from '../utils/cn';
import { CURRENT_USER } from '../data/mockData';

export interface SearchPageProps {
  onNavigateProfile?: (userId: number) => void;
  onNavigateLogin?: () => void;
}

const POPULAR_SEARCH_TAGS = ['aditya', 'srisha', 'social', 'beautiful', 'network', 'graph'];

export const SearchPage: React.FC<SearchPageProps> = ({
  onNavigateProfile,
  onNavigateLogin,
}) => {
  const { currentUser: authUser, isAuthenticated } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchFilterType>('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [userPage, setUserPage] = useState(1);
  const [postPage, setPostPage] = useState(1);
  const [isLoadingMoreUsers, setIsLoadingMoreUsers] = useState(false);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);

  // Interaction states
  const [pendingFollowIds, setPendingFollowIds] = useState<Set<number>>(new Set());
  const [pendingLikeIds, setPendingLikeIds] = useState<Set<number>>(new Set());

  // Ref to hold the active AbortController to cancel stale in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce the input query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute search when debounced query or activeTab changes
  const performSearch = useCallback(
    async (queryText: string, filterType: SearchFilterType) => {
      if (!queryText) {
        setResults(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      // Abort any ongoing in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);
      setUserPage(1);
      setPostPage(1);

      try {
        const data = await executeSearch(queryText, filterType, 1, 10, controller.signal);
        setResults(data);
      } catch (err: any) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          // Request was aborted due to newer input; do nothing
          return;
        }
        console.error('[Search Request Failed]:', err);
        const msg = err.response?.data?.error || 'Failed to complete search. Please try again.';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    performSearch(debouncedQuery, activeTab);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedQuery, activeTab, performSearch]);

  // Load More Users
  const handleLoadMoreUsers = async () => {
    if (!results || !results.users.hasMore || isLoadingMoreUsers || !debouncedQuery) return;
    setIsLoadingMoreUsers(true);
    const nextPage = userPage + 1;

    try {
      const data = await executeSearch(debouncedQuery, 'users', nextPage, 10);
      setResults((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          users: {
            ...data.users,
            items: [...prev.users.items, ...data.users.items],
          },
        };
      });
      setUserPage(nextPage);
    } catch (err: any) {
      console.error('[Load More Users Error]:', err);
    } finally {
      setIsLoadingMoreUsers(false);
    }
  };

  // Load More Posts
  const handleLoadMorePosts = async () => {
    if (!results || !results.posts.hasMore || isLoadingMorePosts || !debouncedQuery) return;
    setIsLoadingMorePosts(true);
    const nextPage = postPage + 1;

    try {
      const data = await executeSearch(debouncedQuery, 'posts', nextPage, 10);
      setResults((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          posts: {
            ...data.posts,
            items: [...prev.posts.items, ...data.posts.items],
          },
        };
      });
      setPostPage(nextPage);
    } catch (err: any) {
      console.error('[Load More Posts Error]:', err);
    } finally {
      setIsLoadingMorePosts(false);
    }
  };

  // Handle Follow / Unfollow from search results
  const handleToggleFollow = async (targetUser: User) => {
    if (!isAuthenticated) {
      onNavigateLogin?.();
      return;
    }

    const { userId, isFollowing } = targetUser;
    if (pendingFollowIds.has(userId)) return;

    setPendingFollowIds((prev) => new Set(prev).add(userId));

    // Optimistic UI update
    setResults((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        users: {
          ...prev.users,
          items: prev.users.items.map((u) =>
            u.userId === userId
              ? {
                  ...u,
                  isFollowing: !isFollowing,
                  followerCount: isFollowing ? Math.max(0, u.followerCount - 1) : u.followerCount + 1,
                }
              : u
          ),
        },
      };
    });

    try {
      if (isFollowing) {
        await unfollowUser(userId);
      } else {
        await followUser(userId);
      }
    } catch (err: any) {
      console.error('[Follow/Unfollow Error in Search]:', err);
      // Revert optimistic update on failure
      setResults((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          users: {
            ...prev.users,
            items: prev.users.items.map((u) =>
              u.userId === userId
                ? {
                    ...u,
                    isFollowing,
                    followerCount: targetUser.followerCount,
                  }
                : u
            ),
          },
        };
      });
    } finally {
      setPendingFollowIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  // Handle Post Likes in Search
  const handleLikeToggle = async (postId: number) => {
    if (!isAuthenticated) {
      onNavigateLogin?.();
      return;
    }

    if (pendingLikeIds.has(postId) || !results) return;

    const targetPost = results.posts.items.find((p) => p.postId === postId);
    if (!targetPost) return;

    const previousLiked = targetPost.isLiked;
    const previousLikeCount = targetPost.likeCount;

    setPendingLikeIds((prev) => new Set(prev).add(postId));

    // Optimistic UI update
    setResults((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        posts: {
          ...prev.posts,
          items: prev.posts.items.map((p) =>
            p.postId === postId
              ? {
                  ...p,
                  isLiked: !previousLiked,
                  likeCount: previousLiked ? Math.max(0, p.likeCount - 1) : p.likeCount + 1,
                }
              : p
          ),
        },
      };
    });

    try {
      if (previousLiked) {
        await unlikePost(postId);
      } else {
        await likePost(postId);
      }
    } catch (err: any) {
      console.error('[Like Error in Search]:', err);
      // Rollback on failure
      setResults((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          posts: {
            ...prev.posts,
            items: prev.posts.items.map((p) =>
              p.postId === postId
                ? {
                    ...p,
                    isLiked: previousLiked,
                    likeCount: previousLikeCount,
                  }
                : p
            ),
          },
        };
      });
    } finally {
      setPendingLikeIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  // Handle Add Comment in Search
  const handleAddComment = async (postId: number, content: string) => {
    if (!isAuthenticated) {
      onNavigateLogin?.();
      return;
    }

    const newComment = await createComment(postId, content);
    if (newComment && newComment.commentId) {
      setResults((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          posts: {
            ...prev.posts,
            items: prev.posts.items.map((p) =>
              p.postId === postId
                ? {
                    ...p,
                    commentCount: p.commentCount + 1,
                    comments: [newComment, ...(p.comments || [])],
                  }
                : p
            ),
          },
        };
      });
    }
  };

  // Handle Delete Comment in Search
  const handleDeleteComment = async (commentId: number, postId: number) => {
    await deleteComment(commentId);
    setResults((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        posts: {
          ...prev.posts,
          items: prev.posts.items.map((p) =>
            p.postId === postId
              ? {
                  ...p,
                  commentCount: Math.max(0, p.commentCount - 1),
                  comments: (p.comments || []).filter((c) => c.commentId !== commentId),
                }
              : p
          ),
        },
      };
    });
  };

  // Active logged-in user representation for PostCard
  const activeViewer: User = authUser
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

  const totalUsers = results?.users.total || 0;
  const totalPosts = results?.posts.total || 0;
  const hasSearched = debouncedQuery.length > 0;
  const isNoResults = hasSearched && !isLoading && !error && totalUsers === 0 && totalPosts === 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16 animate-fadeIn">
      {/* 1. Header & Search Input */}
      <div className="bg-white border border-[#dbdbdb] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-pink-500 to-purple-600 p-[1.5px] flex items-center justify-center shadow-xs shadow-pink-500/20">
              <div className="w-full h-full bg-white rounded-[6px] flex items-center justify-center">
                <SearchIcon className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-none">Search & Discovery</h2>
              <p className="text-[11px] text-gray-500 mt-1">
                Explore graph nodes across users, names, and post captions
              </p>
            </div>
          </div>
        </div>

        {/* Input Field */}
        <div className="relative">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search people, @usernames, or post captions..."
            maxLength={100}
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0095f6]/40 focus:border-[#0095f6] transition-all text-gray-900 placeholder:text-gray-400"
          />
          {isLoading && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#0095f6]">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
          {!isLoading && searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Clear search input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'all'
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Results</span>
            {hasSearched && !isLoading && (
              <span className="text-[10px] opacity-80 px-1 py-0.2 rounded-full bg-white/20">
                {totalUsers + totalPosts}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'users'
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>People</span>
            {hasSearched && !isLoading && (
              <span className="text-[10px] opacity-80 px-1 py-0.2 rounded-full bg-white/20">
                {totalUsers}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'posts'
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Posts</span>
            {hasSearched && !isLoading && (
              <span className="text-[10px] opacity-80 px-1 py-0.2 rounded-full bg-white/20">
                {totalPosts}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3 text-red-700 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="text-xs font-medium">{error}</span>
          </div>
          <Button
            size="xs"
            variant="outline"
            onClick={() => performSearch(debouncedQuery, activeTab)}
            leftIcon={<RefreshCw className="w-3 h-3" />}
          >
            Retry
          </Button>
        </div>
      )}

      {/* 3. Initial Empty State (Prompt to Search) */}
      {!hasSearched && (
        <div className="bg-white border border-[#dbdbdb] rounded-2xl p-8 sm:p-10 text-center space-y-6 shadow-2xs">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-purple-100 via-pink-100 to-amber-100 flex items-center justify-center text-purple-600 shadow-inner">
            <Sparkles className="w-8 h-8 text-pink-500" />
          </div>

          <div className="space-y-1.5 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-gray-900">Find Anyone & Anything on SocialNet</h3>
            <p className="text-xs text-gray-500">
              Query connected graph nodes in real-time. Search by username, full name, or explore post discussions.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Suggested Graph Queries</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
              {POPULAR_SEARCH_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSearchQuery(tag)}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 hover:text-black border border-gray-200/80 rounded-full text-xs font-medium text-gray-600 transition-colors cursor-pointer"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="bg-white border border-[#dbdbdb] rounded-xl p-4 shadow-2xs space-y-3 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-3 pt-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200"></div>
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. Zero Results State */}
      {isNoResults && (
        <div className="bg-white border border-[#dbdbdb] rounded-2xl p-8 sm:p-10 text-center space-y-4 shadow-2xs animate-fadeIn">
          <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
            <SearchIcon className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-gray-900">
              No results found for "{debouncedQuery}"
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Check for typos, search for alternate names, or try exploring broader keywords.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSearchQuery('')}>
            Clear Search
          </Button>
        </div>
      )}

      {/* 6. User Results Section */}
      {hasSearched && !isLoading && (activeTab === 'all' || activeTab === 'users') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                People ({results?.users.total || 0})
              </h3>
            </div>
            {activeTab === 'all' && (results?.users.total || 0) > 3 && (
              <button
                onClick={() => setActiveTab('users')}
                className="text-xs font-semibold text-[#0095f6] hover:underline flex items-center gap-0.5"
              >
                <span>View all people</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {(results?.users.items.length || 0) === 0 ? (
            activeTab === 'users' && !isNoResults && (
              <div className="bg-white border border-[#dbdbdb] rounded-xl p-6 text-center text-xs text-gray-500">
                No people matched "{debouncedQuery}".
              </div>
            )
          ) : (
            <div className="bg-white border border-[#dbdbdb] rounded-xl divide-y divide-gray-100 shadow-2xs overflow-hidden">
              {(activeTab === 'all'
                ? results?.users.items.slice(0, 4)
                : results?.users.items
              )?.map((user) => {
                const isOwnProfile = authUser?.userId === user.userId;
                const isFollowPending = pendingFollowIds.has(user.userId);

                return (
                  <div
                    key={user.userId}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50/70 transition-colors"
                  >
                    <div
                      className="flex items-center gap-3 min-w-0 cursor-pointer group flex-1"
                      onClick={() => onNavigateProfile?.(user.userId)}
                    >
                      <Avatar src={user.avatarUrl} alt={user.fullName} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-gray-900 group-hover:text-[#0095f6] transition-colors truncate">
                            {user.fullName}
                          </span>
                          {user.isVerified && (
                            <ShieldCheck className="w-4 h-4 text-[#0095f6] shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                          {formatNumberCompact(user.followerCount)} followers ·{' '}
                          {formatNumberCompact(user.postCount)} posts
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isOwnProfile ? (
                        <span className="text-xs font-semibold text-gray-400 px-2 py-1 bg-gray-100 rounded-md">
                          You
                        </span>
                      ) : (
                        <Button
                          size="xs"
                          variant={user.isFollowing ? 'outline' : 'primary'}
                          onClick={() => handleToggleFollow(user)}
                          disabled={isFollowPending}
                          leftIcon={
                            isFollowPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : user.isFollowing ? (
                              <UserCheck className="w-3 h-3 text-gray-600" />
                            ) : (
                              <UserPlus className="w-3 h-3 text-white" />
                            )
                          }
                        >
                          {user.isFollowing ? 'Following' : 'Follow'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More Users Button */}
          {activeTab === 'users' && results?.users.hasMore && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMoreUsers}
                disabled={isLoadingMoreUsers}
                leftIcon={
                  isLoadingMoreUsers ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )
                }
              >
                {isLoadingMoreUsers ? 'Loading More People...' : 'Load More People'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 7. Post Results Section */}
      {hasSearched && !isLoading && (activeTab === 'all' || activeTab === 'posts') && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-pink-600" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Posts ({results?.posts.total || 0})
              </h3>
            </div>
          </div>

          {(results?.posts.items.length || 0) === 0 ? (
            activeTab === 'posts' && !isNoResults && (
              <div className="bg-white border border-[#dbdbdb] rounded-xl p-6 text-center text-xs text-gray-500">
                No posts matched "{debouncedQuery}".
              </div>
            )
          ) : (
            <div className="space-y-4">
              {results?.posts.items.map((post) => (
                <PostCard
                  key={post.postId}
                  post={post}
                  currentUser={activeViewer}
                  onLikeToggle={handleLikeToggle}
                  onSaveToggle={() => {}}
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                  onUserClick={(u) => onNavigateProfile?.(u.userId)}
                />
              ))}
            </div>
          )}

          {/* Load More Posts Button */}
          {activeTab === 'posts' && results?.posts.hasMore && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMorePosts}
                disabled={isLoadingMorePosts}
                leftIcon={
                  isLoadingMorePosts ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )
                }
              >
                {isLoadingMorePosts ? 'Loading More Posts...' : 'Load More Posts'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
