import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSnapshot } from '../../contexts/SnapshotContext';
import { useTheme } from '../../contexts/ThemeContext';
import GlobalSearch from './GlobalSearch';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuth();
  const { currentSnapshot, setCurrentSnapshot, snapshots } = useSnapshot();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm h-14 flex items-center px-4 gap-4 shrink-0">
      <button onClick={onToggleSidebar} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Toggle sidebar">
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">OCI Visualizer</h1>

      <div className="flex-1 flex items-center justify-center gap-4">
        <GlobalSearch />
        <select
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-200 min-w-[200px]"
          value={currentSnapshot?.id || ''}
          onChange={(e) => {
            const snap = snapshots.find((s: any) => s.id === e.target.value);
            setCurrentSnapshot(snap || null);
          }}
        >
          <option value="">Select snapshot...</option>
          {snapshots.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name} ({s.resourceCount || 0} resources)</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={toggleTheme} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Toggle dark mode">
          {theme === 'dark' ? (
            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-300">{user?.email}</span>
        <button onClick={logout} className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium">
          Logout
        </button>
      </div>
    </header>
  );
}
