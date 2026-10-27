import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, ShieldAlert, Sparkles, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

export interface LoginPageProps {
  onNavigateRegister: () => void;
  onNavigateFeed: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigateRegister,
  onNavigateFeed,
}) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validation
    if (!identifier.trim()) {
      setErrorMessage('Please enter your username or email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(identifier.trim(), password);
    setIsSubmitting(false);

    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => {
        onNavigateFeed();
      }, 600);
    } else {
      setErrorMessage(result.error || 'Authentication failed. Please verify your credentials.');
    }
  };

  const handleFillDemo = (username: string, pass: string) => {
    setIdentifier(username);
    setPassword(pass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Return to Feed Action */}
      <div className="w-full max-w-sm mb-4">
        <button
          onClick={onNavigateFeed}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Social Feed (as guest)</span>
        </button>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Main Card */}
        <div className="bg-white border border-[#dbdbdb] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px] shadow-sm shadow-pink-500/20">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-pink-600" />
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
              SocialNet
            </h1>
            <p className="text-xs text-gray-400">Log in to your social graph account</p>
          </div>

          {/* Success State Notification */}
          {isSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium text-center animate-fadeIn">
              Authentication successful! Redirecting to feed...
            </div>
          )}

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 animate-fadeIn">
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identifier (Username or Email) */}
            <div className="space-y-1.5">
              <label htmlFor="identifier" className="block text-xs font-semibold text-gray-700">
                Username or Email
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-gray-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. aditya_demo or name@example.com"
                  className="w-full pl-9 pr-3 py-2 bg-[#fafafa] border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0095f6]/30 focus:border-[#0095f6] transition-all"
                  autoComplete="username"
                  disabled={isSubmitting || isSuccess}
                />
              </div>
            </div>

            {/* Password with Show/Hide Toggle */}
            <div className="space-y-1.5">
              <label htmlFor="password-field" className="block text-xs font-semibold text-gray-700">
                Password
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-gray-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password-field"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2 bg-[#fafafa] border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0095f6]/30 focus:border-[#0095f6] transition-all"
                  autoComplete="current-password"
                  disabled={isSubmitting || isSuccess}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              fullWidth
              size="md"
              isLoading={isSubmitting}
              disabled={isSubmitting || isSuccess}
              leftIcon={<LogIn className="w-4 h-4" />}
            >
              Log In
            </Button>
          </form>

          {/* Quick Demo Credentials Assistant (for testing & evaluation) */}
          <div className="pt-2 border-t border-gray-100">
            <span className="text-[11px] font-semibold text-gray-400 block mb-2 text-center">
              Testing Demo Accounts (Activated via CLI):
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFillDemo('aditya_demo', 'Aditya@VIT2026!')}
                className="p-2 text-left bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-xs"
              >
                <div className="font-bold text-gray-800 truncate">aditya_demo</div>
                <div className="text-[10px] text-gray-400">ID 101 · Student</div>
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo('srisha_demo', 'Srisha@VIT2026!')}
                className="p-2 text-left bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-xs"
              >
                <div className="font-bold text-gray-800 truncate">srisha_demo</div>
                <div className="text-[10px] text-gray-400">ID 102 · Designer</div>
              </button>
            </div>
          </div>
        </div>

        {/* Link to Registration Box */}
        <div className="bg-white border border-[#dbdbdb] rounded-2xl p-4 text-center text-xs text-gray-600">
          <span>Don't have an account? </span>
          <button
            onClick={onNavigateRegister}
            className="font-bold text-[#0095f6] hover:text-[#1877f2] focus:outline-none"
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
};
