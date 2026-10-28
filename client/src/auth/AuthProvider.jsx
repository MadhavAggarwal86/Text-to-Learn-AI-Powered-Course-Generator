import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAccessTokenGetter } from '../utils/api.js';
import { auth0Config, authEnabled } from './config.js';

/**
 * One auth interface for the whole app, whether Auth0 is configured or not:
 * { enabled, isLoading, isAuthenticated, user, error, login(returnTo?), signup(), logout() }
 */
const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** Must be rendered inside the router (it navigates after the login redirect). */
export function AuthProvider({ children }) {
  return authEnabled ? <Auth0Auth>{children}</Auth0Auth> : <DevAuth>{children}</DevAuth>;
}

function Auth0Auth({ children }) {
  const navigate = useNavigate();

  return (
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: auth0Config.audience,
        scope: 'openid profile email',
      }}
      // Refresh tokens in local storage keep users signed in across reloads without
      // relying on third-party cookies (which browsers increasingly block).
      cacheLocation="localstorage"
      useRefreshTokens
      onRedirectCallback={(appState) => navigate(appState?.returnTo ?? '/', { replace: true })}
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
}

function Auth0Bridge({ children }) {
  const queryClient = useQueryClient();
  const {
    isLoading,
    isAuthenticated,
    user,
    error,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  // Let the API client attach access tokens to requests.
  useEffect(() => {
    setAccessTokenGetter(() => getAccessTokenSilently());
  }, [getAccessTokenSilently]);

  const login = useCallback(
    (returnTo) => loginWithRedirect({ appState: { returnTo } }),
    [loginWithRedirect],
  );
  const signup = useCallback(
    () => loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } }),
    [loginWithRedirect],
  );
  const logout = useCallback(() => {
    queryClient.clear(); // don't leave one user's courses in memory for the next
    auth0Logout({ logoutParams: { returnTo: window.location.origin } });
  }, [auth0Logout, queryClient]);

  const value = useMemo(
    () => ({ enabled: true, isLoading, isAuthenticated, user, error, login, signup, logout }),
    [isLoading, isAuthenticated, user, error, login, signup, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const DEV_AUTH = {
  enabled: false,
  isLoading: false,
  isAuthenticated: true,
  user: { name: 'Local dev user' },
  error: null,
  login: () => {},
  signup: () => {},
  logout: () => {},
};

function DevAuth({ children }) {
  return <AuthContext.Provider value={DEV_AUTH}>{children}</AuthContext.Provider>;
}
