import React, { useState } from 'react';
import { Image, Palette, Send, Sparkles, X, AlertCircle } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { User, Post } from '../../types';
import { TypographyPostCard } from '../ui/TypographyPostCard';
import { createPost } from '../../services/postService';

export interface PostComposerProps {
  currentUser: User;
  onPostCreated: (newPost: Post) => void;
  isModal?: boolean;
  onCloseModal?: () => void;
}

type ThemeType = 'sunset' | 'ocean' | 'emerald' | 'berry' | 'midnight' | 'amber';

export const PostComposer: React.FC<PostComposerProps> = ({
  currentUser,
  onPostCreated,
  isModal = false,
  onCloseModal,
}) => {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeType>('sunset');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['Neo4j', 'DBMS']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const maxChars = 280;
  const charsRemaining = maxChars - content.length;

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const cleanTag = tagInput.trim().replace(/^#/, '');
      if (!tags.includes(cleanTag) && tags.length < 5) {
        setTags([...tags, cleanTag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanContent = content.trim();
    if (!cleanContent || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const createdPost = await createPost(cleanContent);
      onPostCreated(createdPost);

      // Reset form only on confirmed backend success
      setContent('');
      setImageUrl('');
      setShowImageInput(false);
      setShowThemePicker(false);
      setErrorMessage(null);
      if (isModal && onCloseModal) {
        onCloseModal();
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Failed to publish post to graph database. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const themes: { id: ThemeType; name: string; bg: string }[] = [
    { id: 'sunset', name: 'Sunset', bg: 'from-rose-500 to-amber-500' },
    { id: 'ocean', name: 'Ocean', bg: 'from-blue-600 to-cyan-500' },
    { id: 'emerald', name: 'Emerald', bg: 'from-emerald-600 to-teal-500' },
    { id: 'berry', name: 'Berry', bg: 'from-purple-700 to-pink-500' },
    { id: 'midnight', name: 'Midnight', bg: 'from-slate-900 to-indigo-900' },
    { id: 'amber', name: 'Amber', bg: 'from-amber-500 to-yellow-500' },
  ];

  return (
    <div
      className={
        isModal
          ? 'space-y-4'
          : 'bg-white border border-[#dbdbdb] rounded-xl p-4 shadow-2xs space-y-3.5 transition-all'
      }
    >
      {/* Top Header with Author */}
      <div className="flex items-center gap-3">
        <Avatar src={currentUser.avatarUrl} alt={currentUser.fullName} size="sm" />
        <div>
          <span className="text-xs font-bold text-gray-900">{currentUser.username}</span>
          <p className="text-[10px] text-gray-400">Share with the Graph Network</p>
        </div>
      </div>

      {/* Main Textarea */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={maxChars}
          placeholder="What's happening on your social graph today? (e.g., Cypher insights, campus updates)..."
          rows={isModal ? 3 : 2}
          className="w-full text-sm placeholder:text-gray-400 bg-[#fafafa] border border-gray-200 rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0095f6]/20 focus:border-[#0095f6] resize-none transition-all"
        />

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Live Preview if text-only with gradient theme selected */}
        {!showImageInput && content.trim().length > 0 && (
          <div className="rounded-xl overflow-hidden border border-gray-200 p-2 bg-gray-50/50 space-y-1.5">
            <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-pink-500" /> Card Preview (Decision 2 Fallback)
            </span>
            <div className="max-w-md mx-auto">
              <TypographyPostCard
                content={content}
                theme={selectedTheme}
                authorName={currentUser.username}
                tags={tags}
              />
            </div>
          </div>
        )}

        {/* Image URL Input Field */}
        {showImageInput && (
          <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-200 animate-fadeIn">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Image className="w-3.5 h-3.5 text-blue-500" /> Image URL (Optional)
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowImageInput(false);
                  setImageUrl('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0095f6]"
            />
            {imageUrl.trim() && (
              <div className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-100 mt-2">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Gradient Theme Picker for Text Posts */}
        {showThemePicker && !showImageInput && (
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-purple-600" /> Select Typography Theme
              </span>
              <button
                type="button"
                onClick={() => setShowThemePicker(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {themes.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setSelectedTheme(t.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-white bg-gradient-to-r ${
                    t.bg
                  } transition-all ${
                    selectedTheme === t.id
                      ? 'ring-2 ring-black scale-105 shadow-sm'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tags Selection & Input */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 text-[11px] font-semibold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full border border-gray-200"
            >
              #{t}
              <button
                type="button"
                onClick={() => handleRemoveTag(t)}
                className="hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {tags.length < 5 && (
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="+ add tag (Enter)"
              className="text-[11px] bg-transparent text-gray-600 placeholder:text-gray-400 px-2 py-0.5 rounded-md border border-dashed border-gray-300 focus:outline-none focus:border-blue-500 w-28"
            />
          )}
        </div>

        {/* Toolbar & Submission Button */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1 text-gray-500">
            {/* Toggle Image */}
            <button
              type="button"
              onClick={() => {
                setShowImageInput(!showImageInput);
                if (!showImageInput) setShowThemePicker(false);
              }}
              className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
                showImageInput ? 'text-blue-600 bg-blue-50' : ''
              }`}
              title="Add Image"
            >
              <Image className="w-4 h-4" />
            </button>

            {/* Toggle Theme Picker for text posts */}
            {!showImageInput && (
              <button
                type="button"
                onClick={() => setShowThemePicker(!showThemePicker)}
                className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
                  showThemePicker ? 'text-purple-600 bg-purple-50' : ''
                }`}
                title="Change Typography Palette"
              >
                <Palette className="w-4 h-4" />
              </button>
            )}

            {/* Character Counter */}
            <span
              className={`text-[11px] ml-2 font-mono ${
                charsRemaining < 30 ? 'text-red-500 font-bold' : 'text-gray-400'
              }`}
            >
              {charsRemaining}
            </span>
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={!content.trim() || isSubmitting}
            isLoading={isSubmitting}
            rightIcon={<Send className="w-3.5 h-3.5" />}
          >
            Post
          </Button>
        </div>
      </form>
    </div>
  );
};
