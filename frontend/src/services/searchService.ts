import { api } from './api';
import { SearchFilterType, SearchResults } from '../types';

/**
 * Executes a search query for users, posts, or both.
 * Supports abort signals to cancel stale in-flight requests during debouncing.
 */
export async function executeSearch(
  query: string,
  type: SearchFilterType = 'all',
  page: number = 1,
  limit: number = 10,
  signal?: AbortSignal
): Promise<SearchResults> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      query: '',
      type,
      users: { items: [], total: 0, page: 1, limit, hasMore: false },
      posts: { items: [], total: 0, page: 1, limit, hasMore: false },
    };
  }

  const response = await api.get('/search', {
    params: {
      q: trimmed,
      type,
      page,
      limit,
    },
    signal,
  });

  return response.data.data;
}
