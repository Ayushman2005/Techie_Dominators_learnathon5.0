import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-white/5 rounded-xl ${className}`}
      style={{
        backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.02) 100%)',
        backgroundSize: '200% 100%'
      }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-5 w-24 rounded-md" />
      </div>
    </div>
  );
}
