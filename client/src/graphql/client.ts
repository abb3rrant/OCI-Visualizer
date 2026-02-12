import { Client, cacheExchange, fetchExchange } from 'urql';

export function createGraphQLClient(getToken: () => string | null) {
  return new Client({
    url: '/graphql',
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => {
      const token = getToken();
      return token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {};
    },
  });
}
