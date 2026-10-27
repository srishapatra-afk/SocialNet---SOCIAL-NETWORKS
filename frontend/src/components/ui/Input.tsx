import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-gray-700">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-gray-400 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-[#fafafa] border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 py-2 transition-all duration-150 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0095f6]/30 focus:border-[#0095f6] disabled:opacity-60 disabled:cursor-not-allowed',
              leftIcon ? 'pl-9 pr-3' : 'px-3',
              rightIcon ? 'pr-9' : 'pr-3',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-gray-400 flex items-center">{rightIcon}</div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-red-500 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-gray-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
