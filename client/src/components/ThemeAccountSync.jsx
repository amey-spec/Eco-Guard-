import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, THEME_VALUES } from '../context/ThemeContext';
import { api } from '../services/api';

/**
 * Keeps the appearance preference in sync with the signed-in account:
 *   · signing in adopts the account's stored theme (the account wins over
 *     whatever this device had), and
 *   · while signed in, local Day/Night/Follow-system changes are pushed back
 *     to the account (debounced) so they follow the user across devices.
 *
 * Guests keep the plain device/localStorage behaviour.
 */
export default function ThemeAccountSync() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const activeUserId = useRef(null);
  const lastAppliedFromAccount = useRef(null);

  // Adopt the account preference when a different account becomes active
  // (login / register / session restore) or on logout we simply stop here.
  useEffect(() => {
    const id = user?.id ?? null;
    if (id === activeUserId.current) return;
    activeUserId.current = id;

    if (user && THEME_VALUES.includes(user.theme)) {
      lastAppliedFromAccount.current = user.theme;
      setTheme(user.theme);
    }
  }, [user]);

  // Mirror local changes back to the account while signed in.
  useEffect(() => {
    if (!user) return undefined;
    // Skip the redundant write right after adopting the account's own value.
    if (theme === lastAppliedFromAccount.current) return undefined;

    const timer = setTimeout(() => {
      api.auth
        .updateTheme(theme)
        .then(({ theme: saved }) => {
          lastAppliedFromAccount.current = saved;
          updateUser({ ...user, theme: saved });
        })
        .catch((err) => {
          // Offline / transient failures: the next sign-in re-syncs anyway.
          console.warn('Could not sync theme preference:', err?.message || err);
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [theme, user, updateUser]);

  return null;
}
