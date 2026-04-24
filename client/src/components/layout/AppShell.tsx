import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import DetailPanel from './DetailPanel';
import DeepSearchModal from '../common/DeepSearchModal';
import { useDetailPanel } from '../../contexts/DetailPanelContext';
import { useComparison } from '../../contexts/ComparisonContext';
import ComparisonPanel from './ComparisonPanel';

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deepSearchOpen, setDeepSearchOpen] = useState(false);
  const { selectedResourceId, resource, loading: resourceLoading, closeResource, openResource } = useDetailPanel();
  const { isComparing } = useComparison();
  const location = useLocation();

  // Close the detail panel when navigating to a different page
  useEffect(() => {
    closeResource();
  }, [location.pathname, closeResource]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    // Escape always closes the detail panel
    if (e.key === 'Escape') {
      if (deepSearchOpen) {
        setDeepSearchOpen(false);
        return;
      }
      if (selectedResourceId) {
        closeResource();
        return;
      }
    }

    // Skip other shortcuts when in an input
    if (isInput) return;

    // "/" focuses global search
    if (e.key === '/') {
      e.preventDefault();
      const searchInput = document.querySelector('[data-global-search]') as HTMLInputElement;
      searchInput?.focus();
      return;
    }

    // Ctrl+Shift+F opens deep search
    if (e.key === 'F' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      setDeepSearchOpen(true);
      return;
    }
  }, [selectedResourceId, closeResource, deepSearchOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900">
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar />}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-6">
          <Outlet />
        </main>
        {selectedResourceId && (
          <div className="transform transition-transform duration-200 ease-in-out">
            {resourceLoading || !resource ? (
              <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col shrink-0 overflow-hidden shadow-lg">
                <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1.5" />
                  </div>
                  <button onClick={closeResource} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i}>
                      <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${60 + i * 8}%` }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <DetailPanel
                resource={resource}
                onClose={closeResource}
                onNavigate={openResource}
              />
            )}
          </div>
        )}
      </div>
      <DeepSearchModal open={deepSearchOpen} onClose={() => setDeepSearchOpen(false)} />
      {isComparing && <ComparisonPanel />}
    </div>
  );
}
