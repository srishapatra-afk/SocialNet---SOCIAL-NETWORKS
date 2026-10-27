import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldAlert,
  Sparkles,
  User,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

export interface RegisterPageProps {
  onNavigateLogin: () => void;
  onNavigateFeed: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onNavigateLogin,
  onNavigateFeed,
}) => {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Real-time password criteria verification
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validations
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('Please provide both first and last names.');
      return;
    }
    if (!username.trim() || username.length < 3) {
      setErrorMessage('Username must be at least 3 characters long.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setErrorMessage('Username can only contain letters, numbers, and underscores.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }
    if (!hasMinLength || !hasLetter || !hasNumber) {
      setErrorMessage('Password does not meet the minimum security requirements.');
      return;
    }
    if (!passwordsMatch) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const result = await register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      gender: 'prefer_not_to_say',
    });
    setIsSubmitting(false);

    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => {
        onNavigateFeed();
      }, 700);
    } else {
      setErrorMessage(result.error || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Return to Feed Action */}
      <div className="w-full max-w-md mb-4">
        <button
          onClick={onNavigateFeed}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Social Feed (as guest)</span>
        </button>
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* Main Card */}
        <div className="bg-white border border-[#dbdbdb] rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
          {/* Brand Header */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px] shadow-sm shadow-pink-500/20">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-pink-600" />
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
              SocialNet
            </h1>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Sign up to share thoughts, follow researchers, and explore the Neo4j graph network.
            </p>
          </div>

          {/* Success State Notification */}
          {isSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium text-center animate-fadeIn">
              Account created successfully! Preparing your feed...
            </div>
          )}

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 animate-fadeIn">
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Names (2 columns) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="reg-first-name" className="block text-xs font-semibold text-gray-700">
                  First Name
                </label>
                <input
                  id="reg-first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Rahul"
                  className="w-full px-3 py-2 bg-[#fafafa] border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0095f6]/30 focus:border-[#0095f6] transition-all"
                  disabled={isSubmitting || isSuccess}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="reg-last-name" className="block text-xs font-semibold text-gray-700">
                  Last Name
                </label>
                <input
                  id="reg-last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Nair"
                  className="w-full px-3 py-2 bg-[#fafafa] border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0095f6]/30 focus:border-[#0095f6] transition-all"
                  disabled={isSubmitting || isSuccess}
                />
              </div>
            </div>

            {/* Username */}
            <div className="space-y-1">
              <label htmlFor="reg-username" className="block text-xs font-semibold text-gray-700">
                Username
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-gray-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="reg-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. rahul_nair"
                  className="w-full pl-9 pr-3 py-2 bg-[#fafafa] border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0095f6]/30 focus:border-[#0095f6] transition-all"
                  disabled={isSubmitting || isSuccess}
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <label htmlFor="reg-email" className="block text-xs font-semibold text-gray-700">
                Email Address
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-gray-400 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahul@example.com"
                  className="w-full pl-9 pr-3 py-2 bg-[#fafafa] border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0095f6]/30 focus:border-[#0095f6] transition-all"
                  disabled={isSubmitting || isSuccess}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label htmlFor="reg-password" className="block text-xs font-semibold text-gray-700">
                Password
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-gray-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pl-9 pr-10 py-2 bg-[#fafafa] border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0095f6]/30 focus:border-[#0095f6] transition-all"
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

            {/* Confirm Password */}
            <div className="space-y-1">
              <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-gray-700">
                Confirm Password
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-gray-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="reg-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full pl-9 pr-3 py-2 bg-[#fafafa] border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0095f6]/30 focus:border-[#0095f6] transition-all"
                  disabled={isSubmitting || isSuccess}
                />
              </div>
            </div>

            {/* Password Security Criteria */}
            <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-[11px] space-y-1">
              <span className="font-semibold text-gray-500 block">Password Requirements:</span>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                  <Check className={`w-3 h-3 ${hasMinLength ? 'opacity-100' : 'opacity-30'}`} />
                  <span>8+ characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLetter ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                  <Check className={`w-3 h-3 ${hasLetter ? 'opacity-100' : 'opacity-30'}`} />
                  <span>At least 1 letter</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                  <Check className={`w-3 h-3 ${hasNumber ? 'opacity-100' : 'opacity-30'}`} />
                  <span>At least 1 number</span>
                </div>
                <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                  <Check className={`w-3 h-3 ${passwordsMatch ? 'opacity-100' : 'opacity-30'}`} />
                  <span>Passwords match</span>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              fullWidth
              size="md"
              isLoading={isSubmitting}
              disabled={isSubmitting || isSuccess}
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              Create Account
            </Button>
          </form>
        </div>

        {/* Link to Login Box */}
        <div className="bg-white border border-[#dbdbdb] rounded-2xl p-4 text-center text-xs text-gray-600">
          <span>Already have an account? </span>
          <button
            onClick={onNavigateLogin}
            className="font-bold text-[#0095f6] hover:text-[#1877f2] focus:outline-none"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
};
