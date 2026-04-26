import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { BookOpen, DollarSign, FileText, LogIn, LogOut, PanelLeft, Settings } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const APP_NAME = "Quote Calculator";

const menuItems = [
  { icon: FileText, label: "Quotes", path: "/" },
  { icon: BookOpen, label: "Blanks Library", path: "/blanks" },
  { icon: DollarSign, label: "Print Costs", path: "/print-costs" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const SIDEBAR_WIDTH_KEY = "qc-sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 320;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const activeMenuItem = menuItems.find((item) =>
    item.path === "/" ? location === "/" : location.startsWith(item.path)
  );

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-border/60" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="h-16 justify-center border-b border-border/60">
            <div className="flex items-center gap-3 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-semibold text-sm tracking-tight truncate text-foreground">
                    {APP_NAME}
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Nav */}
          <SidebarContent className="gap-0 pt-2">
            <SidebarMenu className="px-2 gap-0.5">
              {menuItems.map((item) => {
                const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 rounded-lg transition-all font-medium text-sm ${
                        isActive
                          ? "bg-primary/10 text-primary hover:bg-primary/15"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t border-border/60">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center">
                    <Avatar className="h-8 w-8 shrink-0 border border-border">
                      <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-none text-foreground">
                          {user.name || "User"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {user.email || ""}
                        </p>
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation("/settings")} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : isCollapsed ? (
              <button
                onClick={() => setLocation("/login")}
                className="h-9 w-9 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring mx-auto"
                aria-label="Sign in"
              >
                <LogIn className="h-4 w-4 text-muted-foreground" />
              </button>
            ) : (
              <div className="space-y-2">
                <Button
                  onClick={() => setLocation("/login")}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <LogIn className="mr-2 h-3.5 w-3.5" />
                  Sign in
                </Button>
                <Button
                  onClick={() => setLocation("/signup")}
                  size="sm"
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                >
                  Create free account
                </Button>
              </div>
            )}
            {!isCollapsed && (
              <p className="text-[11px] text-muted-foreground/70 text-center mt-2 px-1 font-[Poppins,sans-serif] tracking-wide">
                Powered by{" "}
                <a
                  href="https://dtfstation.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground/70 hover:text-muted-foreground hover:underline transition-colors"
                >
                  DTF Station
                </a>
              </p>
            )}
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        {!isMobile && (
          <div
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
            onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
            style={{ zIndex: 50 }}
          />
        )}
      </div>

      <SidebarInset className="bg-background">
        {/* Mobile top bar */}
        {isMobile && (
          <div className="flex border-b border-border/60 h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                  <FileText className="w-3 h-3 text-white" />
                </div>
                <span className="font-semibold text-sm text-foreground">
                  {activeMenuItem?.label ?? APP_NAME}
                </span>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 min-h-screen">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
