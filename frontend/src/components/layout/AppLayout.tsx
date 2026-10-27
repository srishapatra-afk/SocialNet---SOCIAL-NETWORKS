import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { RightPanel } from './RightPanel';
import { User, SuggestedUser, GroupSnippet } from '../../types';

export interface AppLayoutProps {
  currentUser: User | null;
  isAuthenticated: boolean;
  suggestedUsers: SuggestedUser[];
  groups: GroupSnippet[];
  activeNav: string;
  onNavSelect: (nav: string) => void;
  onCreatePostClick: () => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onLogoutClick: () => void;
  onNavigateProfile?: (userId: number) => void;
  unreadCount?: number;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentUser,
  isAuthenticated,
  suggestedUsers,
  groups,
  activeNav,
  onNavSelect,
  onCreatePostClick,
  onLoginClick,
  onRegisterClick,
  onLogoutClick,
  onNavigateProfile,
  unreadCount,
  children,
}) => {
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col md:flex-row justify-center">
      {/* Fixed Left Sidebar on Desktop */}
      <Sidebar
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
        activeNav={activeNav}
        onNavSelect={onNavSelect}
        onCreatePostClick={onCreatePostClick}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onLogoutClick={onLogoutClick}
        unreadCount={unreadCount}
      />

      {/* Top Mobile Header */}
      <Header
        isAuthenticated={isAuthenticated}
        onLoginClick={onLoginClick}
      />

      {/* Center Main Stage + Right Rail Container */}
      <div className="flex-1 md:ml-64 lg:ml-72 flex justify-center pb-20 md:pb-8">
        <div className="flex w-full max-w-5xl justify-center">
          {/* Feed Content Column */}
          <main className="w-full max-w-xl px-2 sm:px-4 py-4 sm:py-6 space-y-6">
            {children}
          </main>

          {/* Desktop Right Rail */}
          {currentUser && (
            <RightPanel
              currentUser={currentUser}
              suggestedUsers={suggestedUsers}
              groups={groups}
              onUserClick={(u) => onNavigateProfile?.(u.userId)}
            />
          )}
        </div>
      </div>

      {/* Fixed Bottom Nav on Mobile */}
      {currentUser && (
        <BottomNav
          currentUser={currentUser}
          activeNav={activeNav}
          onNavSelect={onNavSelect}
          onCreatePostClick={onCreatePostClick}
        />
      )}
    </div>
  );
};
