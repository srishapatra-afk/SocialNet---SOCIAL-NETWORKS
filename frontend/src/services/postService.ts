import { api } from './api';
import { Post, Comment } from '../types';

export interface FeedResponse {
  status: 'success' | 'error';
  data: {
    posts: Post[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
}

/**
 * Fetches paginated social feed from the backend Neo4j API.
 */
export async function fetchPosts(
  page: number = 1,
  limit: number = 10,
  filter?: string
): Promise<FeedResponse> {
  const params: Record<string, any> = { page, limit };
  if (filter && filter !== 'all') {
    params.filter = filter;
  }

  const response = await api.get<FeedResponse>('/posts', { params });
  return response.data;
}

export interface CreatePostResponse {
  status: 'success' | 'error';
  data: {
    post: Post;
  };
}

/**
 * Creates a new post in the Neo4j Aura graph database.
 * Submits caption and returns the full persisted Post node.
 */
export async function createPost(caption: string): Promise<Post> {
  const response = await api.post<CreatePostResponse>('/posts', {
    caption,
  });
  return response.data.data.post;
}

export interface LikeResponse {
  status: 'success' | 'error';
  data: {
    postId: number;
    likeCount: number;
    isLiked: boolean;
  };
}

/**
 * Likes a post: PUT /api/posts/:postId/like
 */
export async function likePost(postId: number): Promise<LikeResponse['data']> {
  const response = await api.put<LikeResponse>(`/posts/${postId}/like`);
  return response.data.data;
}

/**
 * Unlikes a post: DELETE /api/posts/:postId/like
 */
export async function unlikePost(postId: number): Promise<LikeResponse['data']> {
  const response = await api.delete<LikeResponse>(`/posts/${postId}/like`);
  return response.data.data;
}

export interface CommentsResponse {
  status: 'success' | 'error';
  data: {
    comments: Comment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
}

export interface CreateCommentResponse {
  status: 'success' | 'error';
  data: {
    comment: Comment;
  };
}

export interface DeleteCommentResponse {
  status: 'success' | 'error';
  message: string;
  data: {
    commentId: number;
  };
}

/**
 * Fetches paginated comments for a post: GET /api/posts/:postId/comments
 */
export async function fetchComments(
  postId: number,
  page: number = 1,
  limit: number = 10
): Promise<CommentsResponse> {
  const response = await api.get<CommentsResponse>(`/posts/${postId}/comments`, {
    params: { page, limit },
  });
  return response.data;
}

/**
 * Creates a comment on a post: POST /api/posts/:postId/comments
 */
export async function createComment(
  postId: number,
  text: string
): Promise<Comment> {
  const response = await api.post<CreateCommentResponse>(`/posts/${postId}/comments`, {
    text,
  });
  return response.data.data.comment;
}

/**
 * Deletes a comment: DELETE /api/comments/:commentId
 */
export async function deleteComment(commentId: number): Promise<void> {
  await api.delete<DeleteCommentResponse>(`/comments/${commentId}`);
}
