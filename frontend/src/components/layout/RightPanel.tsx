import React, { useState } from 'react';
import { Database, ShieldCheck, Users } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { User, SuggestedUser, GroupSnippet } from '../../types';

export interface RightPanelProps {
  currentUser: User;
  suggestedUsers: SuggestedUser[];
  groups: GroupSnippet[];
  onUserClick?: (user: User) => void;
  className?: string;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  currentUser,
  suggestedUsers: initialSuggestions,
  groups: initialGroups,
  onUserClick,
  className,
}) => {
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>(initialSuggestions);
  const [groups, setGroups] = useState<GroupSnippet[]>(initialGroups);

  const toggleFollow = (userId: number) => {
    setSuggestions((prev) =>
      prev.map((u) => (u.userId === userId ? { ...u, isFollowing: !u.isFollowing } : u))
    );
  };

  const toggleGroupJoin = (groupId: number) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.groupId === groupId
          ? {
              ...g,
              isMember: !g.isMember,
              memberCount: g.isMember ? g.memberCount - 1 : g.memberCount + 1,
            }
          : g
      )
    );
  };

  return (
    <aside className={`hidden xl:block w-80 2xl:w-88 pl-8 py-6 space-y-6 ${className || ''}`}>
      {/* Current User Card */}
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onUserClick?.(currentUser)}
        >
          <Avatar
            src={currentUser.avatarUrl}
            alt={currentUser.fullName}
            size="md"
            hasStory={true}
            unseenStory={false}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-gray-900 group-hover:underline truncate">
                {currentUser.username}
              </span>
              {currentUser.isVerified && (
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              )}
            </div>
            <p className="text-xs text-gray-400 truncate">{currentUser.fullName}</p>
          </div>
        </div>

        <button className="text-xs font-bold text-[#0095f6] hover:text-[#1877f2] transition-colors">
          Switch
        </button>
      </div>

      {/* Suggested Users Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Suggested for you
          </span>
          <button className="text-xs font-semibold text-gray-900 hover:text-gray-500 transition-colors">
            See All
          </button>
        </div>

        <div className="space-y-3">
          {suggestions.slice(0, 4).map((user) => (
            <div key={user.userId} className="flex items-center justify-between gap-2">
              <div
                className="flex items-center gap-3 min-w-0 cursor-pointer group"
                onClick={() => onUserClick?.(user)}
              >
                <Avatar src={user.avatarUrl} alt={user.fullName} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-900 group-hover:underline truncate">
                      {user.username}
                    </span>
                    {user.isVerified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 truncate">
                    {user.relationContext || user.fullName}
                  </p>
                </div>
              </div>

              <button
                onClick={() => toggleFollow(user.userId)}
                className={`text-xs font-bold transition-colors shrink-0 ${
                  user.isFollowing
                    ? 'text-gray-400 hover:text-red-500'
                    : 'text-[#0095f6] hover:text-[#1877f2]'
                }`}
              >
                {user.isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Campus & Graph Groups Snippet */}
      <div className="p-4 bg-gradient-to-br from-gray-50 to-indigo-50/40 rounded-xl border border-gray-200/70 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
          <Users className="w-4 h-4 text-purple-600" />
          <span>Active Graph Groups</span>
        </div>

        <div className="space-y-2.5">
          {groups.map((group) => (
            <div key={group.groupId} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{group.name}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {group.memberCount} members · {group.category}
                </p>
              </div>
              <Button
                size="xs"
                variant={group.isMember ? 'outline' : 'secondary'}
                onClick={() => toggleGroupJoin(group.groupId)}
              >
                {group.isMember ? 'Joined' : 'Join'}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Live Graph Architecture Badge */}
      <div className="p-3 bg-white rounded-xl border border-gray-200 text-xs text-gray-500 space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-gray-800">
          <Database className="w-3.5 h-3.5 text-pink-600" />
          <span>Graph Foundation</span>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          7 Node Labels · 12 Relationship Types · 7 Uniqueness Constraints on Neo4j Aura.
        </p>
      </div>

      {/* Academic Footer */}
      <footer className="text-[11px] text-gray-400 space-y-2 leading-relaxed">
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <span className="hover:underline cursor-pointer">About</span>
          <span>·</span>
          <span className="hover:underline cursor-pointer">Schema</span>
          <span>·</span>
          <span className="hover:underline cursor-pointer">API Docs</span>
          <span>·</span>
          <span className="hover:underline cursor-pointer">Security</span>
          <span>·</span>
          <span className="hover:underline cursor-pointer">Neo4j Aura</span>
        </div>
        <p>© 2026 DBMS DA3 · Social Networks Assignment</p>
      </footer>
    </aside>
  );
};
