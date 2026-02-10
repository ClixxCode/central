'use client';

import { useEffect } from 'react';
import { useBoardViewStore } from './boardViewStore';
import { usePersonalRollupStore } from './personalRollupStore';

export function StoreHydration() {
  useEffect(() => {
    useBoardViewStore.persist.rehydrate();
    usePersonalRollupStore.persist.rehydrate();
  }, []);
  return null;
}
