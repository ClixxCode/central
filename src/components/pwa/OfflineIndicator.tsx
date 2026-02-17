"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      // Hide the reconnected message after 3 seconds
      setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transform animate-in slide-in-from-bottom-4",
        "rounded-full px-4 py-2 shadow-lg",
        isOnline ? "bg-green-600" : "bg-slate-800"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>Back online</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>You&apos;re offline</span>
          </>
        )}
      </div>
    </div>
  );
}
