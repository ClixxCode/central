"use client";

import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Automatically redirect when back online
      window.location.href = "/";
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <div className="rounded-full bg-muted p-6">
            <WifiOff className="h-16 w-16 text-muted-foreground/70" />
          </div>
        </div>

        <h1 className="mb-4 text-2xl font-semibold text-foreground">
          You&apos;re offline
        </h1>

        <p className="mb-8 text-muted-foreground">
          It looks like you&apos;ve lost your internet connection. Some features
          may be unavailable until you&apos;re back online.
        </p>

        {isOnline ? (
          <div className="mb-8 rounded-lg bg-green-50 dark:bg-green-500/20 p-4">
            <p className="text-green-700 dark:text-green-400">
              You&apos;re back online! Redirecting...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              onClick={handleRetry}
              className="w-full"
              size="lg"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>

            <p className="text-sm text-muted-foreground">
              Your work is saved locally and will sync when you reconnect.
            </p>
          </div>
        )}

        <div className="mt-12 border-t border-border pt-8">
          <h2 className="mb-4 font-medium text-foreground">
            While you&apos;re offline, you can:
          </h2>
          <ul className="space-y-2 text-left text-sm text-muted-foreground">
            <li className="flex items-start">
              <span className="mr-2 text-green-500">✓</span>
              View previously loaded tasks and boards
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-green-500">✓</span>
              Make changes that will sync when online
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-green-500">✓</span>
              Access cached content and attachments
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
