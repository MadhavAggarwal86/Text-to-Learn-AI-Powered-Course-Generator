import { Link, Outlet } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            Text-to-Learn
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}
