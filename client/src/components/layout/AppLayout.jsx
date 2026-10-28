import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import ServerStatusBanner from '../common/ServerStatusBanner.jsx';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function AppLayout() {
  // Only matters below the lg breakpoint, where the sidebar is a drawer.
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Topbar onMenuClick={() => setDrawerOpen(true)} />
      <ServerStatusBanner />
      <div className="mx-auto flex max-w-7xl">
        <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
