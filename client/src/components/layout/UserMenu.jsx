import { LogIn, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider.jsx';

export default function UserMenu() {
  const { enabled, isLoading, isAuthenticated, user, login, logout } = useAuth();

  if (!enabled) {
    return (
      <span
        className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        title="Auth0 is not configured: running as a single local user"
      >
        Dev mode
      </span>
    );
  }
  if (isLoading)
    return <span className="h-8 w-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />;
  if (!isAuthenticated) {
    return (
      <button type="button" onClick={() => login()} className="btn-primary px-3 py-1.5">
        <LogIn className="h-4 w-4" />
        Log in
      </button>
    );
  }
  return <SignedInMenu user={user} onLogout={logout} />;
}

function SignedInMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const name = user?.name ?? user?.email ?? 'Account';

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
      >
        <Avatar user={user} name={name} />
        <span className="hidden max-w-36 truncate text-sm font-medium sm:block">{name}</span>
      </button>

      {open && (
        <div role="menu" className="card absolute right-0 mt-2 w-64 overflow-hidden p-1 shadow-lg">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{name}</p>
            {user?.email && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({ user, name }) {
  const [failed, setFailed] = useState(false);
  if (user?.picture && !failed) {
    return (
      <img
        src={user.picture}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
