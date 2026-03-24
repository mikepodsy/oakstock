# Guest Access with Login Button — Design Spec

## Objective

Allow unauthenticated users to browse the full Oakstock app in read-only mode. Display a Login button in the top-right of the content area for guests. Authenticated users see no change to their current experience.

## Approach

Use Clerk middleware to make all routes publicly accessible. Add a slim `AuthHeader` bar that conditionally renders for unauthenticated users only, containing a single Login button that redirects to `/sign-in`.

## Files Changed

### 1. `src/middleware.ts` (new)

Add Clerk middleware with all routes public:

```ts
import { clerkMiddleware } from "@clerk/nextjs/server";
export default clerkMiddleware();
export const config = { matcher: ["/((?!.*\\..*|_next).*)", "/"] };
```

### 2. `src/components/layout/AuthHeader.tsx` (new)

Client component that:
- Uses `useAuth()` from `@clerk/nextjs` to check `isSignedIn`
- **Signed in or loading:** renders nothing
- **Not signed in:** renders a slim horizontal bar with a single "Log In" button on the right

Styling:
- `bg-bg-secondary` background, `border-b border-border-primary`
- Slim height (~h-10)
- Button right-aligned with `px-4`
- Login button: green primary accent (`bg-green-primary text-white`), links to `/sign-in`

Renders on both desktop and mobile.

### 3. `src/app/layout.tsx` (modified)

Import `AuthHeader` and place it inside the content column, above `MarketOverviewBar`:

```
<div className="flex-1 flex flex-col overflow-hidden">
  <AuthHeader />          <!-- new -->
  <MarketOverviewBar />
  <main>...</main>
</div>
```

## What Stays the Same

- **Sidebar**: `<UserButton />` from Clerk already renders nothing when unauthenticated — no changes needed.
- **DataProvider**: Already checks `isSignedIn` before hydrating portfolio/watchlist stores — guests get empty stores.
- **API routes**: Already return 401 for unauthenticated requests — no changes needed.
- **Pages**: All pages render their UI regardless of auth state. Data-dependent sections show empty/loading states for guests.

## Behavior Summary

| User State | AuthHeader | Sidebar UserButton | Data Loading |
|---|---|---|---|
| Guest | Shows Login button | Hidden (Clerk default) | Skipped |
| Signed in | Hidden | Shows avatar/menu | Normal |
