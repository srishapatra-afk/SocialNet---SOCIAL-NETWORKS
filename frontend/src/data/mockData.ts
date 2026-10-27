import { User, Post, Story, SuggestedUser, GroupSnippet } from '../types';

/**
 * Realistic Mock Data for DBMS Social Networks Frontend.
 * Preserves existing Neo4j sample records (Users 101 & 102, Posts 201 & 202).
 * Clearly segregated from live API integration layer.
 */

export const MOCK_USERS: User[] = [
  {
    userId: 101,
    username: 'aditya_demo',
    fullName: 'Aditya Sharma',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    bio: 'CS Undergrad @ VIT · Graph Algorithms, Systems & Full-Stack · Building SocialNet on Neo4j Aura 🚀',
    isVerified: true,
    followerCount: 342,
    followingCount: 189,
    postCount: 14,
  },
  {
    userId: 102,
    username: 'srisha_demo',
    fullName: 'Srisha Rao',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
    bio: 'Product Designer & Data Explorer · Visualizing Graph Relationships · Coffee & Neo4j Cypher ☕📊',
    isVerified: true,
    followerCount: 521,
    followingCount: 230,
    postCount: 28,
  },
  {
    userId: 103,
    username: 'arjun_verma',
    fullName: 'Arjun Verma',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    bio: 'Distributed Systems enthusiast · Competitive coder & hackathon junkie',
    isVerified: false,
    followerCount: 215,
    followingCount: 142,
    postCount: 9,
    isFollowing: true,
  },
  {
    userId: 104,
    username: 'neha_patel',
    fullName: 'Neha Patel',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
    bio: 'AI & Data Science · Exploring graph neural networks and knowledge graphs',
    isVerified: true,
    followerCount: 780,
    followingCount: 410,
    postCount: 42,
    isFollowing: false,
  },
  {
    userId: 105,
    username: 'rohit_kumar',
    fullName: 'Rohit Kumar',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    bio: 'Database geek · ACID compliance advocate · Open source contributor',
    isVerified: false,
    followerCount: 168,
    followingCount: 195,
    postCount: 11,
    isFollowing: false,
  },
];

export const CURRENT_USER: User = MOCK_USERS[0]; // aditya_demo (ID 101)

export const MOCK_STORIES: Story[] = [
  {
    storyId: 's-1',
    user: MOCK_USERS[1], // srisha_demo
    hasUnseen: true,
    previewImageUrl: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=400&q=80',
  },
  {
    storyId: 's-2',
    user: MOCK_USERS[2], // arjun_verma
    hasUnseen: true,
    previewImageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80',
  },
  {
    storyId: 's-3',
    user: MOCK_USERS[3], // neha_patel
    hasUnseen: true,
    previewImageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=400&q=80',
  },
  {
    storyId: 's-4',
    user: MOCK_USERS[4], // rohit_kumar
    hasUnseen: false,
    previewImageUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=400&q=80',
  },
  {
    storyId: 's-5',
    user: {
      userId: 106,
      username: 'tanya_shukla',
      fullName: 'Tanya Shukla',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80',
      followerCount: 310,
      followingCount: 220,
      postCount: 19,
    },
    hasUnseen: true,
  },
];

export const MOCK_POSTS: Post[] = [
  {
    postId: 201,
    authorId: 101,
    author: MOCK_USERS[0],
    content:
      'Excited to kick off our DBMS DA3 project! We are modeling real-world social network relationships directly in Neo4j Aura using graph traversal patterns. Zero joins, pure graph speed! 🌐⚡',
    gradientTheme: 'sunset',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45m ago
    likeCount: 42,
    commentCount: 4,
    isLiked: false,
    isSaved: false,
    tags: ['DBMS', 'Neo4j', 'GraphDatabase', 'VIT'],
    comments: [
      {
        commentId: 301,
        postId: 201,
        author: MOCK_USERS[1],
        content: 'Graph queries are so much cleaner than recursive SQL CTEs! Loving the architecture.',
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        likeCount: 6,
        isLiked: true,
      },
      {
        commentId: 302,
        postId: 201,
        author: MOCK_USERS[2],
        content: 'Wait until we test the concurrency-safe counter nodes with atomic write locks!',
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        likeCount: 2,
        isLiked: false,
      },
    ],
  },
  {
    postId: 203,
    authorId: 102,
    author: MOCK_USERS[1],
    content:
      'Designing the Instagram-inspired layout for SocialNet. Focused on high-contrast visual balance, typography cards for text posts, and clean navigation rails. What do you think of this color palette? ✨🎨',
    imageUrl:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2h ago
    likeCount: 89,
    commentCount: 7,
    isLiked: true,
    isSaved: true,
    tags: ['UIUX', 'DesignSystem', 'TailwindCSS', 'Frontend'],
    comments: [
      {
        commentId: 303,
        postId: 203,
        author: MOCK_USERS[0],
        content: 'The gradient accent along the brand header looks super sleek!',
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        likeCount: 4,
      },
      {
        commentId: 304,
        postId: 203,
        author: MOCK_USERS[3],
        content: 'Love that text-only posts get their own curated visual cards. Such a thoughtful UX touch.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        likeCount: 3,
      },
    ],
  },
  {
    postId: 202,
    authorId: 102,
    author: MOCK_USERS[1],
    content:
      'Graph theory quote of the day: "Everything is connected, but some connections are more meaningful than others." Our 12 relationship types make friendship, groups, and post interactions feel alive! 🧠💡',
    gradientTheme: 'ocean',
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(), // 4h ago
    likeCount: 65,
    commentCount: 2,
    isLiked: false,
    isSaved: false,
    tags: ['GraphTheory', 'SocialNetwork', 'Insights'],
    comments: [
      {
        commentId: 305,
        postId: 202,
        author: MOCK_USERS[4],
        content: 'Deep insight! Relationship properties like timestamps and roles are key.',
        createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        likeCount: 1,
      },
    ],
  },
  {
    postId: 204,
    authorId: 104,
    author: MOCK_USERS[3],
    content:
      'Late night code sprints at the tech lab. Hooking up our Vite build pipeline with React 18 concurrent features. The developer experience is buttery smooth! 💻☕',
    imageUrl:
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(), // 6h ago
    likeCount: 112,
    commentCount: 5,
    isLiked: false,
    isSaved: false,
    tags: ['TechLab', 'Coding', 'Vite', 'React'],
    comments: [
      {
        commentId: 306,
        postId: 204,
        author: MOCK_USERS[2],
        content: 'Grab some coffee Neha, great progress!',
        createdAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
        likeCount: 2,
      },
    ],
  },
  {
    postId: 205,
    authorId: 103,
    author: MOCK_USERS[2],
    content:
      'Remember: naive MAX(id) + 1 is a concurrency disaster waiting to happen. Always use atomic sequence counters with transaction write locks! Protect your database integrity at all costs. 🛡️🔐',
    gradientTheme: 'emerald',
    createdAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(), // 10h ago
    likeCount: 78,
    commentCount: 3,
    isLiked: true,
    isSaved: false,
    tags: ['DatabaseArchitecture', 'Concurrency', 'ACID'],
    comments: [],
  },
];

export const MOCK_SUGGESTED_USERS: SuggestedUser[] = [
  {
    ...MOCK_USERS[3], // neha_patel
    mutualFollowers: ['srisha_demo', 'arjun_verma'],
    relationContext: 'Followed by srisha_demo + 1 other',
  },
  {
    ...MOCK_USERS[4], // rohit_kumar
    mutualFollowers: ['arjun_verma'],
    relationContext: 'Followed by arjun_verma',
  },
  {
    userId: 107,
    username: 'ananya_sen',
    fullName: 'Ananya Sen',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    bio: 'Mobile Dev & Flutter fanatic',
    followerCount: 240,
    followingCount: 180,
    postCount: 15,
    mutualFollowers: ['srisha_demo'],
    relationContext: 'Suggested for you',
    isFollowing: false,
  },
];

export const MOCK_GROUPS: GroupSnippet[] = [
  {
    groupId: 301,
    name: 'Neo4j Graph Explorers',
    description: 'Cypher query optimizations and graph schema design discussions',
    memberCount: 84,
    category: 'Technology',
    isMember: true,
  },
  {
    groupId: 302,
    name: 'VIT CS Developers',
    description: 'College student developers, hackathons, and project collaborations',
    memberCount: 215,
    category: 'Campus',
    isMember: false,
  },
];
