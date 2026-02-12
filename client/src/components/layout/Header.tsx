import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSnapshot } from '../../contexts/SnapshotContext';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuth();
  const { currentSnapshot, setCurrentSnapshot, snapshots } = useSnapshot();

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm h-14 flex items-center px-4 gap-4 shrink-0">
      <button onClick={onToggleSidebar} className="p-1.5 rounded-lg hover:bg-gray-100" title="Toggle sidebar">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h1 className="text-lg font-bold text-gray-800 whitespace-nowrap">OCI Visualizer</h1>

      <div className="flex-1 flex justify-center">
        <select
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white min-w-[200px]"
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
        <span className="text-sm text-gray-600">{user?.email}</span>
        <button onClick={logout} className="text-sm text-red-600 hover:text-red-800 font-medium">
          Logout
        </button>
      </div>
    </header>
  );
}
