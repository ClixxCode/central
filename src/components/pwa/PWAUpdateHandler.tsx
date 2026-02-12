"use client";

import { useEffect } from "react";

/**
 * Detects when a new service worker is installed (i.e. a new deployment)
 * and reloads the page so PWA users get the latest version.
 */
export function PWAUpdateHandler() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleSWUpdate = async () => {
      const registration = await navigator.serviceWorker.ready;

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          // New SW is installed and waiting (or already active via skipWaiting).
          // If there's already a controlling SW, this means we've updated.
          if (
            newWorker.state === "activated" &&
            navigator.serviceWorker.controller
          ) {
            window.location.reload();
          }
        });
      });
    };

    // Also handle the case where skipWaiting fires controllerchange
    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );
    handleSWUpdate();

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );
    };
  }, []);

  return null;
}
