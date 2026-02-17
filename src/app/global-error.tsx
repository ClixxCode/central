"use client";

import { Inter } from "next/font/google";
import { AlertTriangle, RefreshCw } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
          <div className="w-full max-w-md text-center">
            <div className="mb-20 flex justify-center">
              <AlertTriangle className="h-24 w-24 text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
            </div>

            <h1 className="mb-4 text-2xl font-semibold">
              Something went wrong
            </h1>

            <div className="mb-4">
              <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                An unexpected error occurred. Please try again,<br />and if the
                problem persists, reach out to support.
              </p>
            </div>

            <div className="mt-10">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-100 px-6 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </button>
            </div>

            <div className="mt-20 flex justify-center">
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
      </body>
    </html>
  );
}
