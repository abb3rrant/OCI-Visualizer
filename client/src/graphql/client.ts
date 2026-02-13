import { Client, cacheExchange, fetchExchange, mapExchange } from 'urql';
import { showToast } from '../components/common/ToastProvider';

let logoutCallback: (() => void) | null = null;

export function setLogoutHandler(fn: () => void) {
  logoutCallback = fn;
}

export function createGraphQLClient(getToken: () => string | null) {
  const errorExchange = mapExchange({
    onError(error) {
      // Check for 401 responses — auto-logout
      const is401 = error.response && (error.response as any).status === 401;
      const hasAuthMessage = error.graphQLErrors?.some((e) =>
        e.message?.toLowerCase().includes('not authenticated'),
      );

      if (is401 || hasAuthMessage) {
        showToast('Session expired. Please log in again.', 'error');
        if (logoutCallback) {
          logoutCallback();
        }
        window.location.href = '/login';
        return;
      }

      // Network errors
      if (error.networkError) {
        showToast(`Network error: ${error.networkError.message}`, 'error');
        return;
      }

      // GraphQL errors
      if (error.graphQLErrors?.length) {
        error.graphQLErrors.forEach((e) => {
          showToast(e.message || 'An unexpected error occurred.', 'error');
        });
      }
    },
  });

  return new Client({
    url: '/graphql',
    exchanges: [cacheExchange, errorExchange, fetchExchange],
    fetchOptions: () => {
      const token = getToken();
      return token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {};
    },
  });
}
