import {
  Outlet,
  Link,
  createRootRoute,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppProviders } from "@/app/providers";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  const router = useRouter();

  // Smart client-side redirect for shorthand or direct URLs (e.g. /team, /roles, /staff)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname.replace(/\/+$/, "");
    const slug = "saffron-ember";

    if (path === "/team" || path === "/staff") {
      window.location.replace(`/app/${slug}/team`);
    } else if (path === "/team/roles" || path === "/roles") {
      window.location.replace(`/app/${slug}/team/roles`);
    } else if (path === "/dashboard" || path === "/pos" || path === "/orders" || path === "/inventory" || path === "/menu") {
      window.location.replace(`/app/${slug}${path}`);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Instant client-side redirect script if SSR rendered */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var p = window.location.pathname.replace(/\\/+$/, '');
                var s = 'saffron-ember';
                if (p === '/team' || p === '/staff') {
                  window.location.replace('/app/' + s + '/team');
                } else if (p === '/team/roles' || p === '/roles') {
                  window.location.replace('/app/' + s + '/team/roles');
                } else if (p === '/dashboard' || p === '/pos' || p === '/orders' || p === '/inventory' || p === '/menu') {
                  window.location.replace('/app/' + s + p);
                }
              } catch (e) {}
            })();
          `,
        }}
      />
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tablewise POS operates with restaurant workspaces. Choose your workspace or navigate to the team directory below.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <a
            href="/app/saffron-ember/team"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Staff Directory
          </a>
          <a
            href="/app/saffron-ember/team/roles"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Roles & Permissions
          </a>
          <a
            href="/workspace/select"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Choose workspace
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-destructive font-mono bg-destructive/10 p-2 rounded">
          {(error as any)?.message || String(error)}
        </p>
        {(error as any)?.stack && (
          <pre className="mt-2 text-xs text-left bg-muted p-2 rounded overflow-auto max-h-60 text-muted-foreground whitespace-pre-wrap">
            {(error as any).stack}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Tablewise POS — Multi-restaurant point of sale" },
      { name: "description", content: "Run POS, kitchen, tables and orders for every restaurant and branch in one place." },
      { property: "og:title", content: "Tablewise POS" },
      { property: "og:description", content: "Multi-restaurant point of sale and kitchen operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Manrope:wght@600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div id="root">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AppProviders>
      <Outlet />
      <Toaster position="top-right" richColors closeButton />
    </AppProviders>
  );
}
