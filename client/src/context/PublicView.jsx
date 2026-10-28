import { createContext, useContext } from 'react';

/**
 * True inside a shared (public, read-only) course. Components that would otherwise call
 * signed-in endpoints, like the video search, switch to their public, cache-only versions.
 */
export const PublicViewContext = createContext(false);

export const usePublicView = () => useContext(PublicViewContext);
