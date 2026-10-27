import { api } from './api';
import { UserProfile, Post } from '../types';

export interface UserProfileResponse {
  status: 'success' | 'error';
  data: {
    profile: UserProfile;
  };
}

export interface UserPostsResponse {
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

export interface FollowResponse {
  status: 'success' | 'error';
  data: {
    userId: number;
    followerCount: number;
    followingCount: number;
    isFollowing: boolean;
  };
}

/**
 * Retrieve public profile for a specific user by userId.
 */
export async function fetchUserProfile(userId: number): Promise<UserProfile> {
  const response = await api.get<UserProfileResponse>(`/users/${userId}/profile`);
  return response.data.data.profile;
}

/**
 * Retrieve posts authored by a specific user.
 */
export async function fetchUserPosts(
  userId: number,
  page: number = 1,
  limit: number = 10
): Promise<UserPostsResponse['data']> {
  const response = await api.get<UserPostsResponse>(`/users/${userId}/posts`, {
    params: { page, limit },
  });
  return response.data.data;
}

/**
 * Follow a user by userId.
 */
export async function followUser(userId: number): Promise<FollowResponse['data']> {
  const response = await api.put<FollowResponse>(`/users/${userId}/follow`);
  return response.data.data;
}

/**
 * Unfollow a user by userId.
 */
export async function unfollowUser(userId: number): Promise<FollowResponse['data']> {
  const response = await api.delete<FollowResponse>(`/users/${userId}/follow`);
  return response.data.data;
}
