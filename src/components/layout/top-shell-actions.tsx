'use client';

import * as React from 'react';

type RegisterTopShellActions = (actions: React.ReactNode) => () => void;

const TopShellActionsContext =
  React.createContext<RegisterTopShellActions | null>(null);

interface TopShellActionsProviderProps {
  children: React.ReactNode;
  registerActions: RegisterTopShellActions;
}

export function TopShellActionsProvider({
  children,
  registerActions,
}: TopShellActionsProviderProps) {
  return (
    <TopShellActionsContext.Provider value={registerActions}>
      {children}
    </TopShellActionsContext.Provider>
  );
}

export function useTopShellActions(actions: React.ReactNode | null) {
  const registerActions = React.useContext(TopShellActionsContext);

  React.useEffect(() => {
    if (!actions || !registerActions) {
      return;
    }

    return registerActions(actions);
  }, [actions, registerActions]);
}
