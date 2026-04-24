import React from 'react';

type CardKey = 'totalUsers' | 'totalPolicies' | 'criticalPaths' | 'privEscPaths';

interface IamSummaryCardsProps {
  summary: {
    totalUsers: number;
    totalPolicies: number;
    criticalPaths: number;
    privEscPaths: number;
  };
  activeCard?: CardKey | null;
  onCardClick?: (key: CardKey) => void;
}

const cards: { key: CardKey; label: string; color: string; bg: string; activeBg: string; icon: string }[] = [
  {
    key: 'totalUsers',
    label: 'Users',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    activeBg: 'bg-blue-100 dark:bg-blue-900/60 ring-2 ring-blue-400 dark:ring-blue-500',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    key: 'totalPolicies',
    label: 'Policies',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    activeBg: 'bg-amber-100 dark:bg-amber-900/60 ring-2 ring-amber-400 dark:ring-amber-500',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    key: 'criticalPaths',
    label: 'Critical Paths',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/30',
    activeBg: 'bg-red-100 dark:bg-red-900/60 ring-2 ring-red-400 dark:ring-red-500',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z',
  },
  {
    key: 'privEscPaths',
    label: 'Priv-Esc Paths',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/30',
    activeBg: 'bg-purple-100 dark:bg-purple-900/60 ring-2 ring-purple-400 dark:ring-purple-500',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  },
];

export default function IamSummaryCards({ summary, activeCard, onCardClick }: IamSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const isActive = activeCard === c.key;
        const isClickable = !!onCardClick && summary[c.key] > 0;
        return (
          <button
            key={c.key}
            onClick={() => isClickable && onCardClick?.(c.key)}
            disabled={!isClickable}
            className={`${isActive ? c.activeBg : c.bg} rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-left transition-all ${
              isClickable
                ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]'
                : 'cursor-default'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">{c.label}</p>
              <svg className={`w-5 h-5 ${c.color} opacity-50`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
              </svg>
            </div>
            <p className={`text-2xl font-bold ${c.color}`}>
              {summary[c.key]}
            </p>
            {isActive && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click again to clear</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

export type { CardKey };
