'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Callback when an error is caught (useful for logging/analytics) */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Show a "Go Home" button in addition to retry */
  showHomeButton?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="rounded-full bg-red-100 dark:bg-red-500/20 p-4 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Something went wrong
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            An unexpected error occurred. Please try again.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="text-xs text-left bg-muted p-4 rounded-lg mb-4 max-w-lg overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2">
            <Button onClick={this.handleRetry} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            {this.props.showHomeButton && (
              <Button asChild variant="outline">
                <Link href="/my-tasks">
                  <Home className="mr-2 h-4 w-4" />
                  Go home
                </Link>
              </Button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorFallback({
  error,
  resetError,
  showHomeButton,
}: {
  error: Error;
  resetError: () => void;
  showHomeButton?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-red-100 dark:bg-red-500/20 p-4 mb-4">
        <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        Something went wrong
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <div className="flex gap-2">
        <Button onClick={resetError} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        {showHomeButton && (
          <Button asChild variant="outline">
            <Link href="/my-tasks">
              <Home className="mr-2 h-4 w-4" />
              Go home
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Inline error display for non-critical errors
 * Use when you want to show an error without replacing the entire UI
 */
export function InlineError({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400 ${className ?? ''}`}
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button onClick={onRetry} variant="ghost" size="sm" className="h-7 px-2 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20">
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}
