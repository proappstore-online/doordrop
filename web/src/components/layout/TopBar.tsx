import React, { useState, useEffect } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuthContext";
import { useThemeMode } from "../../ThemeModeProvider";
import { useUserData } from "../../hooks/useUserData";
import { APP_TITLE } from "../../config";
import logoDark from "../../assets/logo.svg";
import logoLight from "../../assets/logo.svg";
import MobileDrawer from "./MobileDrawer";
import ProfileMenu from "./ProfileMenu";
import NotificationBell from "./NotificationBell";
import MessagesBadge from "./MessagesBadge";
import { requestPushPermission } from "../../services/pushNotifications";

const TopBar: React.FC = () => {
  const { userData } = useUserData();
  const { currentUser, loading } = useAuth();
  const { mode } = useThemeMode();
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (currentUser) {
      requestPushPermission(currentUser.id);
    }
  }, [currentUser]);

  const currentPath = location.pathname;
  const isWalkerPath = currentPath.startsWith("/walker");
  const isAppPath = currentPath.startsWith("/app");
  const userRole = userData?.role;

  const getNavLinks = () => {
    if (isWalkerPath && userRole === "walker") {
      return [
        { label: "Dashboard", to: "/walker" },
        { label: "Deliver", to: "/walker/deliver" },
        { label: "Campaigns", to: "/walker/streets" },
        { label: "History", to: "/walker/history" },
      ];
    } else if (isAppPath && userRole === "client") {
      return [
        { label: "Campaigns", to: "/app" },
        { label: "Addresses", to: "/app/properties" },
        { label: "Flyers", to: "/app/flyers" },
        { label: "+ New Campaign", to: "/app/setup" },
      ];
    }
    return [];
  };

  const navLinks = getNavLinks();
  const bgColor = mode === "dark" ? "#4A9B7D" : "#2D7D7D";

  return (
    <>
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b border-gray-200 dark:border-gray-700"
        style={{ backgroundColor: bgColor }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left side: Hamburger (mobile) + Logo + Title */}
          <div className={`flex items-center ${isMobile ? "gap-2" : "gap-4"}`}>
            {/* Hamburger menu - mobile only */}
            {isMobile && currentUser && (
              <button
                onClick={() => setDrawerOpen(true)}
                className="text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Logo */}
            <img
              src={mode === "dark" ? logoDark : logoLight}
              alt="Logo"
              className="w-10 h-10 rounded-full"
            />

            {/* Title - hidden on mobile */}
            {!isMobile && (
              <RouterLink
                to="/"
                className="text-white text-xl font-bold tracking-wide hover:opacity-90 transition-opacity no-underline"
              >
                {APP_TITLE}
              </RouterLink>
            )}
          </div>

          {/* Right side: Nav links (desktop) + Profile menu */}
          <div className="flex items-center">
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : currentUser ? (
              <>
                {/* Desktop nav links */}
                {!isMobile &&
                  navLinks.map((link) => (
                    <RouterLink
                      key={link.to}
                      to={link.to}
                      className="mx-3 font-medium text-white hover:text-yellow-200 hover:underline transition-colors no-underline"
                    >
                      {link.label}
                    </RouterLink>
                  ))}

                {/* Messages */}
                <MessagesBadge />

                {/* Notifications */}
                <NotificationBell />

                {/* Profile menu */}
                <ProfileMenu />
              </>
            ) : (
              <RouterLink
                to="/login"
                className="px-6 py-2 border-2 border-white text-white rounded-full hover:bg-white hover:text-emerald-700 transition-colors font-medium no-underline"
              >
                Login
              </RouterLink>
            )}
          </div>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

export default TopBar;
