'use client';

import { createContext, useContext } from 'react';
import {
  defaultCentralFeatureFlags,
  type CentralFeatureFlags,
} from './types';

const CentralFeatureFlagsContext = createContext<CentralFeatureFlags>(defaultCentralFeatureFlags);

export function CentralFeatureFlagsProvider({
  children,
  flags,
}: {
  children: React.ReactNode;
  flags: CentralFeatureFlags;
}) {
  return (
    <CentralFeatureFlagsContext.Provider value={flags}>
      {children}
    </CentralFeatureFlagsContext.Provider>
  );
}

export function useCentralFeatureFlags() {
  return useContext(CentralFeatureFlagsContext);
}
