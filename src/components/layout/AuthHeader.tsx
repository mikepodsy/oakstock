"use client";

import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";
import { LogIn } from "lucide-react";
import { SearchBar } from "./SearchBar";

export function AuthHeader() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <div className="flex items-center justify-end gap-3 h-12 px-4 bg-bg-secondary border-b border-border-primary shrink-0">
      <SearchBar />
      {!isLoaded ? null : isSignedIn ? (
        <UserButton />
      ) : (
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-green-primary text-white hover:opacity-90 transition-opacity"
        >
          <LogIn className="h-4 w-4" />
          Log In
        </Link>
      )}
    </div>
  );
}
