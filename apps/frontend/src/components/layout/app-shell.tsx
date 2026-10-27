import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  Moon,
  Palette,
  Plus,
  Repeat,
  Search,
  Sun,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { RestaurantThemeModal } from "@/features/theme/restaurant-theme-modal";
import { NAVIGATION, type AppPath } from "@/config/navigation.config";
import { ROLE_LABELS } from "@/config/permissions.config";
import { useTenant } from "@/features/tenant/tenant-context";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { setColorMode, toggleSidebar } from "@/features/ui/ui.slice";
import { setBranch } from "@/features/tenant/tenant.slice";
import { useSignOut } from "@/features/auth/require-session";
import { useMarkNotificationsReadMutation, useNotificationsQuery } from "@/app/api";
import { useRealtimeNotifications } from "@/features/notifications/use-realtime-notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = Object.fromEntries(NAVIGATION.flatMap((g) => g.items.map((i) => [i.path, i.label])));

function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { tenant, can } = useTenant();
  return (
    <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAVIGATION.map((g) => {
        const items = g.items.filter((i) => can(i.permission));
        if (!items.length) return null;
        return (
          <div key={g.label}>
            {!collapsed && <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</p>}
            <ul className="space-y-0.5">
              {items.map((i) => (
                <li key={i.path}>
                  <Link
                    to={`/app/$tenantSlug/${i.path}` as `/app/$tenantSlug/${AppPath}`}
                    params={{ tenantSlug: tenant.slug }}
                    onClick={onNavigate}
                    title={collapsed ? i.label : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
                      collapsed && "justify-center",
                    )}
                    activeProps={{ className: "bg-sidebar-accent font-semibold text-sidebar-accent-foreground [&>svg]:text-primary" }}
                  >
                    <i.icon className="size-4 shrink-0" aria-hidden />
                    {!collapsed && i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function BranchSelect({ compact }: { compact?: boolean }) {
  const { tenant, branches, branch } = useTenant();
  const dispatch = useAppDispatch();
  if (branches.length < 2) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
        <Building2 className="size-4 text-muted-foreground" aria-hidden />
        {!compact && branch.name}
      </div>
    );
  }
  return (
    <Select value={branch.id} onValueChange={(v) => dispatch(setBranch({ tenantId: tenant.id, branchId: v }))}>
      <SelectTrigger aria-label="Branch" className="h-9">
        <Building2 className="size-4 text-muted-foreground" aria-hidden />
        {!compact && <SelectValue />}
      </SelectTrigger>
      <SelectContent>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  const { tenant } = useTenant();
  return (
    <div className={cn("flex items-center gap-2.5 px-4 py-4", collapsed && "justify-center px-2")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground">
        {tenant.initials}
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate font-display font-bold leading-tight">{tenant.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{tenant.tagline}</span>
        </span>
      )}
    </div>
  );
}

function Notifications() {
  const { tenant } = useTenant();
  useRealtimeNotifications(tenant.id);
  const { data = [] } = useNotificationsQuery(tenant.id, {
    pollingInterval: 30000,
    refetchOnFocus: true,
  });
  const [markRead] = useMarkNotificationsReadMutation();
  const [open, setOpen] = useState(false);
  const unread = data.filter((n) => !n.read).length;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && unread > 0) {
      markRead(tenant.id);
    }
  };

  const handleItemClick = (n: (typeof data)[number]) => {
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} className="relative">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            className="size-6 text-muted-foreground hover:text-foreground -mr-1 rounded-sm"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </Button>
        </div>
        <ul className="max-h-80 divide-y overflow-y-auto">
          {data.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">You're all caught up.</li>}
          {data.map((n) => (
            <li
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={cn(
                "px-4 py-3 text-sm transition-colors cursor-pointer hover:bg-muted/50",
                !n.read && "bg-primary-soft/60"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-foreground">{n.title}</p>
                {!n.read && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/80">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
            </li>
          ))}
        </ul>
        <div className="border-t p-2 text-center bg-muted/20">
          <Link
            to="/app/$tenantSlug/notifications"
            params={{ tenantSlug: tenant.slug }}
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all notifications &rarr;
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { tenant, user, role, can, activation } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const mode = useAppSelector((s) => s.ui.colorMode);
  const signOut = useSignOut();
  const [q, setQ] = useState("");
  const [themeOpen, setThemeOpen] = useState(false);
  const segs = location.pathname.split("/").slice(3);
  const first = segs[0] ?? "";
  const two = segs.slice(0, 2).join("/");
  const crumb = LABELS[two] ?? LABELS[first] ?? first;
  const isDetail = segs.length > 1 && !LABELS[two] && !["menu", "inventory", "finance", "team"].includes(first);

  return (
    <>
      {activation.status === "grace" && (
        <div role="status" className="border-b border-warning/40 bg-warning/15 px-4 py-1.5 text-center text-xs">
          {activation.message}
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label="Open navigation">
          <Menu className="size-4" />
        </Button>
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
          <span className="truncate text-muted-foreground">{tenant.name}</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{crumb}</span>
          {isDetail && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">Detail</span>
            </>
          )}
        </nav>
        <form
          className="relative ml-auto hidden w-64 md:block"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (!can("orders.view")) return;
            navigate({ to: "/app/$tenantSlug/orders", params: { tenantSlug: tenant.slug }, search: { q: q.trim(), status: "all" } });
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search orders, tables, guests…" className="h-9 pl-8" aria-label="Search orders" />
        </form>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          {can("pos.use") && (
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/app/$tenantSlug/pos" params={{ tenantSlug: tenant.slug }}>
                <Plus className="size-4" /> New order
              </Link>
            </Button>
          )}
          <Notifications />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Customize restaurant theme atmosphere"
            title="Theme & Atmosphere"
            onClick={() => setThemeOpen(true)}
          >
            <Palette className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Toggle dark mode" onClick={() => dispatch(setColorMode(mode === "dark" ? "light" : "dark"))}>
            {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
                <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">{user.initials}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="font-medium">{user.name}</p>
                <p className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[role]} · {user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {can("settings.manage") && (
                <DropdownMenuItem onSelect={() => navigate({ to: "/app/$tenantSlug/settings", params: { tenantSlug: tenant.slug } })}>
                  <UtensilsCrossed className="size-4" /> Restaurant settings
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => navigate({ to: "/workspace/select" })}>
                <Repeat className="size-4" /> Switch restaurant
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={signOut}>
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <RestaurantThemeModal open={themeOpen} onOpenChange={setThemeOpen} />
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const dispatch = useAppDispatch();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar transition-[width] md:flex", collapsed ? "w-16" : "w-60")}>
        <Brand collapsed={collapsed} />
        <div className="px-3">
          <BranchSelect compact={collapsed} />
        </div>
        <NavLinks collapsed={collapsed} />
        <div className="border-t p-3">
          <Button variant="ghost" size="sm" className="w-full justify-center" onClick={() => dispatch(toggleSidebar())} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
          </Button>
          {!collapsed && (
            <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <UtensilsCrossed className="size-3" aria-hidden /> Tablewise POS · demo data
            </p>
          )}
        </div>
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-72 flex-col bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand collapsed={false} />
          <div className="px-3"><BranchSelect /></div>
          <NavLinks collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
