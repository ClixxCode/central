import { useEffect, useState } from 'react';

/**
 * Hook to detect if the component has mounted on the client.
 * Useful for preventing hydration mismatches with persisted state.
 */
export function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}
