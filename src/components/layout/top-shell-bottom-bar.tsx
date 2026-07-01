'use client';

import * as React from 'react';

type RegisterTopShellBottomBar = (content: React.ReactNode) => () => void;

const TopShellBottomBarContext =
  React.createContext<RegisterTopShellBottomBar | null>(null);

interface TopShellBottomBarProviderProps {
  children: React.ReactNode;
  registerBottomBar: RegisterTopShellBottomBar;
}

export function TopShellBottomBarProvider({
  children,
  registerBottomBar,
}: TopShellBottomBarProviderProps) {
  return (
    <TopShellBottomBarContext.Provider value={registerBottomBar}>
      {children}
    </TopShellBottomBarContext.Provider>
  );
}

export function useTopShellBottomBar(content: React.ReactNode | null) {
  const registerBottomBar = React.useContext(TopShellBottomBarContext);

  React.useEffect(() => {
    if (!content || !registerBottomBar) {
      return;
    }

    return registerBottomBar(content);
  }, [content, registerBottomBar]);
}
