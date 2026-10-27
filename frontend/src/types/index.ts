/**
 * Domain TypeScript types for DBMS Social Networks Frontend.
 * Aligns with Neo4j Aura graph schema (7 node labels, 12 relationship types).
 */

export interface User {
  userId: number;
  username: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  isVerified?: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isFollowing?: boolean;
}

export interface UserProfile extends User {
  firstName?: string;
  lastName?: string;
  createdAt?: string;
  isOwnProfile?: boolean;
}

export interface Comment {
  commentId: number;
  postId: number;
  author: User;
  content: string;
  createdAt: string;
  likeCount: number;
  isLiked?: boolean;
}

export interface Post {
  postId: number;
  authorId: number;
  author: User;
  content: string;
  imageUrl?: string;
  gradientTheme?: 'sunset' | 'ocean' | 'emerald' | 'berry' | 'midnight' | 'amber';
  createdAt: string;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isSaved: boolean;
  tags?: string[];
  comments?: Comment[];
}

export interface Story {
  storyId: string;
  user: User;
  hasUnseen: boolean;
  previewImageUrl?: string;
}

export interface SuggestedUser extends User {
  mutualFollowers?: string[];
  relationContext?: string;
}

export interface GroupSnippet {
  groupId: number;
  name: string;
  description: string;
  memberCount: number;
  category: string;
  isMember?: boolean;
}

export interface Notification {
  notificationId: string;
  notificationSequence: number;
  type: 'follow' | 'like' | 'comment' | 'system';
  message: string;
  isRead: boolean;
  createdAt: string;
  actor?: User;
  postId?: number;
  commentId?: number;
}

export type FeedFilterType = 'for-you' | 'following' | 'text-only' | 'media';

export type SearchFilterType = 'all' | 'users' | 'posts';

export interface SearchPagination<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SearchResults {
  query: string;
  type: SearchFilterType;
  users: SearchPagination<User>;
  posts: SearchPagination<Post>;
}
