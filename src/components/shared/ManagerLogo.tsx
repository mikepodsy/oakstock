"use client";

import { useState } from "react";

const AVATAR_COLORS = [
  "from-emerald-500 to-teal-600", "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600", "from-orange-500 to-amber-600",
  "from-rose-500 to-pink-600", "from-cyan-500 to-sky-600",
  "from-lime-500 to-green-600", "from-fuchsia-500 to-violet-600",
  "from-red-500 to-rose-600", "from-yellow-500 to-orange-600",
];

function avatarColor(id: string): string {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Fund/manager logo. Renders the brand logo (via logo.dev by domain, same source as
// stock logos) when available, otherwise falls back to a gradient initials avatar.
export function ManagerLogo({
  id,
  name,
  logoDomain,
  className = "w-14 h-14 rounded-2xl",
  textClassName = "text-lg",
}: {
  id: string;
  name: string;
  logoDomain?: string | null;
  className?: string;
  textClassName?: string;
}) {
  const [err, setErr] = useState(false);

  if (logoDomain && !err) {
    return (
      <img
        src={`/api/logo?domain=${encodeURIComponent(logoDomain)}`}
        alt={`${name} logo`}
        className={`${className} object-contain bg-white shrink-0`}
        onError={() => setErr(true)}
      />
    );
  }

  return (
    <div
      className={`${className} bg-gradient-to-br ${avatarColor(id)} flex items-center justify-center text-white font-bold shrink-0 ${textClassName}`}
    >
      {getInitials(name)}
    </div>
  );
}
