import React from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  hoverEffect = false,
  className,
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4 sm:p-5',
    lg: 'p-6',
  };

  return (
    <div
      className={cn(
        'bg-white border border-[#dbdbdb] rounded-xl overflow-hidden shadow-xs',
        paddingStyles[padding],
        hoverEffect && 'transition-shadow duration-200 hover:shadow-md hover:border-gray-300',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
