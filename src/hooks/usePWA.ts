"use client";

import { useState, useEffect } from "react";

interface PWAStatus {
  isInstalled: boolean;
  isOnline: boolean;
  isStandalone: boolean;
  canInstall: boolean;
}

export function usePWA(): PWAStatus {
  const [status, setStatus] = useState<PWAStatus>({
    isInstalled: false,
    isOnline: true,
    isStandalone: false,
    canInstall: false,
  });

  useEffect(() => {
    // Check if running as standalone (installed)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error - iOS specific property
      window.navigator.standalone === true;

    // Check initial online status
    const isOnline = navigator.onLine;

    setStatus((prev) => ({
      ...prev,
      isStandalone,
      isInstalled: isStandalone,
      isOnline,
    }));

    // Listen for online/offline events
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
    };

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = () => {
      setStatus((prev) => ({ ...prev, canInstall: true }));
    };

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setStatus((prev) => ({
        ...prev,
        isInstalled: true,
        canInstall: false,
      }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return status;
}
