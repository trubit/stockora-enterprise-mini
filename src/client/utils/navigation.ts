import type { NavigateFunction, NavigateOptions } from 'react-router-dom';

/**
 * Navigation Bridge:
 * Allows non-React contexts (e.g. Axios interceptors, global socket handlers, error boundaries)
 * to perform client-side React Router navigation without triggering full browser reloads.
 */
let routerNavigate: NavigateFunction | null = null;

export const setAppNavigator = (navigate: NavigateFunction): void => {
  routerNavigate = navigate;
};

export const appNavigate = (to: string, options?: NavigateOptions): void => {
  if (typeof window !== 'undefined') {
    // Avoid redundant navigation if already on the target path
    const currentPath = window.location.pathname;
    if (currentPath === to) {
      return;
    }
  }

  if (routerNavigate) {
    routerNavigate(to, options);
  } else if (typeof window !== 'undefined') {
    // Safe fallback if router has not yet mounted (e.g. fatal bootstrap failure)
    if (options?.replace) {
      window.location.replace(to);
    } else {
      window.location.assign(to);
    }
  }
};

export const getCurrentPath = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.pathname;
  }
  return '';
};
