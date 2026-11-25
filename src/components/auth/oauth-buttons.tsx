"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  startOAuthFlow,
  type OAuthAuthSource,
  type OAuthProviderId,
} from "@/lib/appwrite/oauth";
import { Button } from "@/components/ui/primitives";

export function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"
      />
    </svg>
  );
}

interface OAuthButtonsProps {
  source: OAuthAuthSource;
  next?: string | null;
  disabled?: boolean;
  onError?: (message: string) => void;
  onLoadingChange?: (provider: OAuthProviderId | null) => void;
}

export function OAuthButtons({
  source,
  next,
  disabled = false,
  onError,
  onLoadingChange,
}: OAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] =
    useState<OAuthProviderId | null>(null);

  function handleProviderClick(provider: OAuthProviderId) {
    setLoadingProvider(provider);
    onLoadingChange?.(provider);
    try {
      startOAuthFlow(provider, { next, source });
    } catch (err) {
      setLoadingProvider(null);
      onLoadingChange?.(null);
      const msg =
        err instanceof Error
          ? err.message
          : `Could not start ${provider === "github" ? "GitHub" : "Google"} sign-in.`;
      onError?.(msg);
      toast.error(msg);
    }
  }

  const isBusy = disabled || loadingProvider !== null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={isBusy}
        onClick={() => handleProviderClick("github")}
        className="h-10 border-zinc-800 bg-zinc-900/50 text-zinc-100 hover:bg-zinc-900 hover:border-zinc-700"
      >
        {loadingProvider === "github" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GitHubIcon className="h-4 w-4" />
        )}
        <span>GitHub</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={isBusy}
        onClick={() => handleProviderClick("google")}
        className="h-10 border-zinc-800 bg-zinc-900/50 text-zinc-100 hover:bg-zinc-900 hover:border-zinc-700"
      >
        {loadingProvider === "google" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        <span>Google</span>
      </Button>
    </div>
  );
}
