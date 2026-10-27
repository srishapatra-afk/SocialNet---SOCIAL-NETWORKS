import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/ProfilePage';
import { SearchPage } from './pages/SearchPage';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { fetchUnreadCount } from './services/notificationService';
import { CURRENT_USER, MOCK_SUGGESTED_USERS, MOCK_GROUPS } from './data/mockData';
import { Button } from './components/ui/Button';
import { Compass, MessageCircle, Users, Calendar, LogIn } from 'lucide-react';
import { User } from './types';

const MainApp: React.FC = () => {
  const { currentUser: authUser, isAuthenticated, logout } = useAuth();
  const [activeNav, setActiveNav] = useState('feed');
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount()
        .then((count) => setUnreadNotifCount(count))
        .catch((err) => console.error('[Unread Count Fetch Error]:', err));
    } else {
      setUnreadNotifCount(0);
    }
  }, [isAuthenticated]);

  const handleNavigateProfile = (userId: number) => {
    setProfileUserId(userId);
    setActiveNav('profile');
  };

  // If viewing dedicated full-page auth routes
  if (activeNav === 'login') {
    return (
      <LoginPage
        onNavigateRegister={() => setActiveNav('register')}
        onNavigateFeed={() => setActiveNav('feed')}
      />
    );
  }

  if (activeNav === 'register') {
    return (
      <RegisterPage
        onNavigateLogin={() => setActiveNav('login')}
        onNavigateFeed={() => setActiveNav('feed')}
      />
    );
  }

  // Active user representation: authenticated user profile OR guest fallback
  const displayUser: User = authUser
    ? {
        userId: authUser.userId,
        username: authUser.username,
        fullName: `${authUser.firstName} ${authUser.lastName}`,
        avatarUrl:
          authUser.avatarUrl ||
          (authUser.userId === 101
            ? CURRENT_USER.avatarUrl
            : `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80`),
        bio: authUser.bio || `Member of SocialNet Neo4j Graph Network · @${authUser.username}`,
        isVerified: true,
        followerCount: authUser.userId === 101 ? 342 : 12,
        followingCount: authUser.userId === 101 ? 189 : 8,
        postCount: authUser.userId === 101 ? 14 : 0,
      }
    : CURRENT_USER;

  return (
    <AppLayout
      currentUser={displayUser}
      isAuthenticated={isAuthenticated}
      suggestedUsers={MOCK_SUGGESTED_USERS}
      groups={MOCK_GROUPS}
      activeNav={activeNav}
      onNavSelect={(nav) => {
        if (nav === 'profile') {
          setProfileUserId(null);
        }
        setActiveNav(nav);
      }}
      onCreatePostClick={() => setIsCreateModalOpen(true)}
      onLoginClick={() => setActiveNav('login')}
      onRegisterClick={() => setActiveNav('register')}
      onLogoutClick={logout}
      onNavigateProfile={handleNavigateProfile}
      unreadCount={unreadNotifCount}
    >
      {/* Guest Mode Notification Banner (if not authenticated) */}
      {!isAuthenticated && activeNav === 'feed' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl p-3 sm:p-4 shadow-2xs flex items-center justify-between gap-3 animate-fadeIn">
          <div>
            <h4 className="text-xs font-bold text-gray-900">Welcome to SocialNet! (Guest Mode)</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">
              You are browsing in read-only guest mode. Log in or create an account to publish and save posts to the graph.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="xs"
              variant="primary"
              onClick={() => setActiveNav('login')}
              leftIcon={<LogIn className="w-3.5 h-3.5" />}
            >
              Log In
            </Button>
          </div>
        </div>
      )}

      {activeNav === 'feed' && (
        <HomePage
          isCreateModalOpen={isCreateModalOpen}
          onCloseCreateModal={() => setIsCreateModalOpen(false)}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          onNavigateLogin={() => setActiveNav('login')}
          onNavigateProfile={handleNavigateProfile}
        />
      )}

      {/* Search Tab View */}
      {activeNav === 'search' && (
        <SearchPage
          onNavigateProfile={handleNavigateProfile}
          onNavigateLogin={() => setActiveNav('login')}
        />
      )}

      {/* Explore Tab View */}
      {activeNav === 'explore' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#dbdbdb] rounded-xl p-5 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-gray-900">Explore Graph Community</h2>
            </div>
            <p className="text-xs text-gray-500">
              Discover emerging topics, campus discussions, and graph researchers across the network.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {[
              'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80',
            ].map((img, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group cursor-pointer shadow-2xs"
              >
                <img
                  src={img}
                  alt={`Explore item ${idx}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-3">
                  <span>❤️ 84</span>
                  <span>💬 12</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages Tab View */}
      {activeNav === 'messages' && (
        <div className="bg-white border border-[#dbdbdb] rounded-2xl p-8 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-[#0095f6]">
            <MessageCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-gray-900">Direct Messages</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Send private, end-to-end directed messages along SENDS and RECEIVED_BY graph relationships.
            </p>
          </div>
          <Button size="sm" onClick={() => setActiveNav('feed')}>
            Back to Feed
          </Button>
        </div>
      )}

      {/* Notifications Tab View */}
      {activeNav === 'notifications' && (
        <NotificationCenter
          onNavigateProfile={handleNavigateProfile}
          onNavigateLogin={() => setActiveNav('login')}
          onUnreadCountChange={setUnreadNotifCount}
        />
      )}

      {/* Groups Tab View */}
      {activeNav === 'groups' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#dbdbdb] rounded-xl p-4 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-gray-900">Campus & Interest Groups</h2>
            </div>
            <span className="text-xs text-gray-400">MEMBER_OF Relationships</span>
          </div>

          <div className="space-y-3">
            {MOCK_GROUPS.map((g) => (
              <div
                key={g.groupId}
                className="bg-white border border-[#dbdbdb] rounded-xl p-4 shadow-2xs flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{g.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {g.memberCount} members · Category: {g.category}
                  </p>
                </div>
                <Button size="xs" variant={g.isMember ? 'outline' : 'primary'}>
                  {g.isMember ? 'Joined' : 'Join Group'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events Tab View */}
      {activeNav === 'events' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#dbdbdb] rounded-xl p-4 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-bold text-gray-900">Campus Graph Events</h2>
            </div>
            <span className="text-xs text-gray-400">ORGANIZES & HOSTS</span>
          </div>

          <div className="bg-white border border-[#dbdbdb] rounded-xl p-6 text-center space-y-3 shadow-2xs">
            <Calendar className="w-10 h-10 mx-auto text-amber-500" />
            <h4 className="text-sm font-bold text-gray-900">DBMS DA3 Project Showcase</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Live presentation of our Neo4j Aura full-stack social network, query optimizations, and concurrency architecture.
            </p>
            <p className="text-xs font-semibold text-gray-700">Date: November 2026 · Hall 4 / Hybrid</p>
          </div>
        </div>
      )}

      {/* Profile Tab View */}
      {activeNav === 'profile' && (
        <ProfilePage
          userId={profileUserId || authUser?.userId}
          onNavigateLogin={() => setActiveNav('login')}
          onNavigateBack={() => setActiveNav('feed')}
          onNavigateProfile={handleNavigateProfile}
        />
      )}
    </AppLayout>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
