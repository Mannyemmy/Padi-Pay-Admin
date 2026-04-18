// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LucideIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getCurrentAdmin, signOutAdmin } from "@/lib/auth";
import { Admin } from "@/lib/types";
import { allRoutes } from "@/lib/routes";
import { DEMO_PREFIX } from "@/lib/demo";
import { activityLogger } from "@/lib/services/activityLogger";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  category?: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);
  const [accessibleRoutes, setAccessibleRoutes] = useState<NavigationItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  // Detect demo mode from pathname prefix
  const isDemoRoute = pathname.startsWith(DEMO_PREFIX);
  const basePath = isDemoRoute ? pathname.slice(DEMO_PREFIX.length) || '/' : pathname;
  const routePrefix = isDemoRoute ? DEMO_PREFIX : '';

  useEffect(() => {
    const loadAdminData = async () => {
      try {
        setLoading(true);
        const admin = await getCurrentAdmin();
        setCurrentAdmin(admin);

        if (admin) {
          // Filter routes based on permissions
          const filteredRoutes = allRoutes.filter((route) => {
            // Admin role always has access to all routes
            if (admin.role === "admin") return true;

            // Check if admin has permission for this route
            return (
              admin.permissions?.[
                route.href as keyof typeof admin.permissions
              ] || false
            );
          });

          setAccessibleRoutes(filteredRoutes);
        } else {
          // If no admin, show all routes (will be redirected by middleware)
          setAccessibleRoutes(allRoutes);
        }
      } catch (error) {
        console.error("Failed to load admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAdminData();
  }, []);


  const handleLogout = async () => {
    try {
      // Get current user before logging out
      const currentUser = auth.currentUser;

      if (currentUser) {
        // Fetch admin data from Firestore before logging out
        try {
          const adminDocRef = doc(db, "admins", currentUser.uid);
          const adminDoc = await getDoc(adminDocRef);

          if (adminDoc.exists()) {
            const adminData = adminDoc.data();

            // Get client information for logging
            const userAgent = navigator.userAgent || "unknown";
            let ip = "unknown";
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3000);
              const ipResponse = await fetch("/api/ip", { signal: controller.signal });
              clearTimeout(timeoutId);
              if (ipResponse.ok) {
                const data = await ipResponse.json();
                ip = data.ip || "unknown";
              }
            } catch {
              // IP fetch is non-critical, continue with "unknown"
            }

            // Log logout activity
            await activityLogger.logLogout(
              currentUser.uid,
              adminData.email || currentUser.email || "",
              adminData.name ||
                adminData.email?.split("@")[0] ||
                currentUser.email?.split("@")[0] ||
                "Unknown",
              userAgent,
              ip || "unknown",
            );
          }
        } catch (fetchError) {
          console.error(
            "Error fetching admin data for logout logging:",
            fetchError,
          );
          // Still proceed with logout even if logging fails
        }
      }

      // Perform the actual logout
      await signOutAdmin();

      // Redirect to login page
      router.push("/login");
      router.refresh(); // Clear any cached data
    } catch (error) {
      console.error("Logout failed:", error);
      // Still redirect to login even if there's an error
      router.push("/login");
    }
  };

  // Group routes by category for better organization
  const groupedRoutes = accessibleRoutes.reduce(
    (acc, route) => {
      const category = route.category || "Other";
      if (!acc[category]) acc[category] = [];
      acc[category].push(route);
      return acc;
    },
    {} as Record<string, NavigationItem[]>,
  );

  // If loading, show minimal skeleton
  if (loading) {
    return (
      <aside className="fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gray-100 border-r border-gray-200">
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <div className="h-8 bg-gray-300 rounded animate-pulse"></div>
          </div>
          <div className="flex-1 p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-10 bg-gray-300 rounded animate-pulse"
              ></div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 rounded-lg bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow"
      >
        {isMobileMenuOpen ? (
          <X className="w-6 h-6 text-gray-900 dark:text-gray-100" />
        ) : (
          <Menu className="w-6 h-6 text-gray-900 dark:text-gray-100" />
        )}
      </button>

      {/* Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          transform transition-all duration-300 ease-in-out
          ${
            isMobileMenuOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }
          ${isCollapsed ? "lg:w-20" : "lg:w-64"} w-64
        `}
        style={{
          backgroundColor: "var(--sidebar-bg, #ffffff)",
          color: "var(--sidebar-text, #374151)",
          borderRightColor: "var(--sidebar-border, #e5e7eb)",
          borderRightWidth: "1px",
        }}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Collapse Button */}
          <div
            className="p-6 flex items-center justify-between"
            style={{
              borderBottomColor: "var(--sidebar-border, #e5e7eb)",
              borderBottomWidth: "1px",
            }}
          >
            {!isCollapsed && (
              <>
                <div>
                  <h1
                    className="text-2xl font-bold"
                    style={{ color: "var(--brand-primary, #3b82f6)" }}
                  >
                    PadiPay
                  </h1>
                  <p
                    className="text-sm"
                    style={{ color: "var(--sidebar-text-secondary, #6b7280)" }}
                  >
                    Admin
                  </p>

                </div>
              </>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex p-2 rounded-lg transition-colors"
              style={{ color: "var(--sidebar-text, #374151)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--sidebar-hover, #f3f4f6)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto">
            {Object.entries(groupedRoutes).map(([category, routes]) => (
              <div key={category} className="mb-6 last:mb-0">
                {!isCollapsed && routes.length > 0 && (
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-2 px-2"
                    style={{ color: "var(--sidebar-text-secondary, #6b7280)" }}
                  >
                    {category}
                  </p>
                )}
                <div className="space-y-1">
                  {routes.map((item) => {
                    const prefixedHref = `${routePrefix}${item.href}`;
                    const isActive = basePath === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={prefixedHref}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg
                          transition-colors duration-200
                        `}
                        style={{
                          backgroundColor: isActive
                            ? "var(--sidebar-active-bg, #e0f2fe)"
                            : "transparent",
                          color: isActive
                            ? "var(--brand-primary, #3b82f6)"
                            : "var(--sidebar-text, #374151)",
                          fontWeight: isActive ? "500" : "400",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive)
                            e.currentTarget.style.backgroundColor =
                              "var(--sidebar-hover, #f3f4f6)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive)
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                        }}
                        title={isCollapsed ? item.name : ""}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && (
                          <span className="text-sm">{item.name}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {accessibleRoutes.length === 0 && !loading && (
              <div className="p-4 text-center">
                <p className="text-sm text-gray-500">No accessible pages</p>
              </div>
            )}
          </nav>

          {/* User profile */}
          <div className="p-4 border-t border-gray-200">
            {!isCollapsed && currentAdmin && (
              <div className="flex items-center gap-3 px-4 py-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold">
                    {currentAdmin.name?.charAt(0) || "A"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {currentAdmin.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {currentAdmin.email}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        currentAdmin.status === "active"
                          ? "bg-green-500"
                          : "bg-gray-300"
                      }`}
                    />
                    <span className="text-xs text-gray-500 capitalize">
                      {currentAdmin.role.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
                isCollapsed ? "justify-center" : ""
              }`}
              title={isCollapsed ? "Logout" : ""}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm">Logout</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
