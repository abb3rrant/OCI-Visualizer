import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import DetailPanel from './DetailPanel';

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailResource, setDetailResource] = useState<any>(null);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar />}
        <main className="flex-1 overflow-auto bg-gray-50 p-6">
          <Outlet context={{ setDetailResource }} />
        </main>
        {detailResource && (
          <DetailPanel resource={detailResource} onClose={() => setDetailResource(null)} />
        )}
      </div>
    </div>
  );
}
