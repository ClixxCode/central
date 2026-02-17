import { Search, X } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-20 flex justify-center">
          <div className="relative h-24 w-24">
            <Search className="absolute inset-0 h-full w-full text-muted-foreground/30" strokeWidth={1.5} />
            {/* X overlaid on the magnifying glass lens, with spin-pause animation */}
            <div
              className="absolute top-[45.8%] left-[45.8%] -translate-x-1/2 -translate-y-1/2"
              style={{ animation: "spin-pause 3s ease-in-out infinite" }}
            >
              <X className="h-8 w-8 text-red-400" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        <h1 className="mb-4 text-2xl font-semibold text-foreground">
          Page not found
        </h1>

        <div className="mb-4">
          <p className="text-muted-foreground mb-4">
            The page you&apos;re looking for doesn&apos;t exist<br />or has been
            moved.
          </p>
        </div>

        <div className="mt-10">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go home
          </Link>
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
  );
}
