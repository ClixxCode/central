"use client";

import { Construction } from "lucide-react";

// Mask for just the rectangular sign part of the Construction icon
const RECT_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Crect x='1' y='5' width='22' height='10' rx='1' fill='white'/%3E%3C/svg%3E")`;

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-20 flex justify-center">
          <div className="relative h-24 w-24">
            {/* Base icon (static) */}
            <Construction className="absolute inset-0 h-full w-full text-black dark:text-white" strokeWidth={2} />
            {/* Animated stripes masked to just the rect sign */}
            <div
              className="maintenance-mask absolute inset-0"
              style={{ "--stripe-mask": RECT_MASK } as React.CSSProperties}
            >
              <div className="maintenance-stripes absolute -inset-1/2 h-[200%] w-[200%] -rotate-45" />
            </div>
          </div>
        </div>

        <h1 className="mb-4 text-2xl font-semibold text-foreground">
          We&apos;ll be right back
        </h1>

        <div className="mb-4">
          <p className="text-muted-foreground mb-4">
            We&apos;re performing scheduled maintenance<br />to improve your
            experience.
          </p>

          <p className="text-muted-foreground mb-20">
            This shouldn&apos;t take long.
          </p>
        </div>
        <div className="mt-10 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/clix_logo_black.png"
            alt="Clix Logo"
            width={24}
            height={24}
            className="opacity-40 dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/clix_logo_white.png"
            alt="Clix Logo"
            width={24}
            height={24}
            className="hidden opacity-40 dark:block"
          />
        </div>
      </div>
    </div>
  );
}
