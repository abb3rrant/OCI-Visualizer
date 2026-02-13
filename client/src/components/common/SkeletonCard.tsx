import React from 'react';

interface SkeletonCardProps {
  count?: number;
}

export default function SkeletonCard({ count = 4 }: SkeletonCardProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3 !p-4">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-2.5 w-1/2 bg-gray-100 dark:bg-gray-600 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
