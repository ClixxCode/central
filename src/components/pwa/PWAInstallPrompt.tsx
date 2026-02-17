"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Share, Plus, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed as standalone
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsStandalone(true);
      return;
    }

    // Check if dismissed previously
    const isDismissed = localStorage.getItem("pwa-install-dismissed");
    if (isDismissed) {
      const dismissedTime = parseInt(isDismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
        return;
      }
    }

    // Detect iOS
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show the install dialog after a delay
      setTimeout(() => {
        if (!dismissed) {
          setShowInstallDialog(true);
        }
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // For iOS, show instructions after a delay
    if (isIOSDevice && !dismissed) {
      setTimeout(() => {
        setShowIOSInstructions(true);
      }, 5000);
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, [dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === "accepted") {
      setDeferredPrompt(null);
    }

    setShowInstallDialog(false);
  };

  const handleDismiss = () => {
    setShowInstallDialog(false);
    setShowIOSInstructions(false);
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  // Don't render if already installed
  if (isStandalone || dismissed) {
    return null;
  }

  // Chrome/Edge install dialog
  if (deferredPrompt && showInstallDialog) {
    return (
      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Install Central
            </DialogTitle>
            <DialogDescription>
              Install Central for a better experience with offline
              access and quick shortcuts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-green-100 dark:bg-green-500/20 p-2">
                <Download className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">Works offline</p>
                <p className="text-sm text-muted-foreground">
                  Access your tasks even without internet
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-500/20 p-2">
                <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">Quick access</p>
                <p className="text-sm text-muted-foreground">
                  Launch from your home screen or dock
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={handleDismiss}>
              Maybe later
            </Button>
            <Button onClick={handleInstall}>
              <Download className="mr-2 h-4 w-4" />
              Install
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // iOS Safari instructions
  if (isIOS && showIOSInstructions) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 sm:left-auto sm:right-4 sm:w-80">
        <div className="rounded-lg border bg-popover p-4 shadow-lg">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium">Install Central</span>
            </div>
            <button
              onClick={handleDismiss}
              className="rounded-md p-1 hover:bg-accent"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <p className="mb-3 text-sm text-muted-foreground">
            Add this app to your home screen for quick access:
          </p>

          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
                1
              </span>
              Tap the{" "}
              <Share className="mx-1 inline h-4 w-4 text-blue-600 dark:text-blue-400" />
              Share button
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
                2
              </span>
              Scroll and tap &quot;Add to Home Screen&quot;
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
                3
              </span>
              Tap &quot;Add&quot; to confirm
            </li>
          </ol>
        </div>
      </div>
    );
  }

  return null;
}
