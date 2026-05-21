import { createContext, useState, useEffect, useContext } from "react";
import type { ReactNode } from "react";

type Mode = "light" | "dark";
const STORAGE_KEY = "theme-mode";

type ThemeModeContextType = {
  mode: Mode;
  toggleTheme: () => void;
  setMode: (m: Mode) => void;
};

const ThemeModeContext = createContext<ThemeModeContextType>({
  mode: "light",
  toggleTheme: () => {},
  setMode: () => {},
});

export const useThemeMode = () => useContext(ThemeModeContext);

export const ThemeModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<Mode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Mode | null;
      if (saved === "light" || saved === "dark") {
        return saved;
      }
    } catch {
      // localStorage may be unavailable (e.g., private browsing), fall through to default
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage may be unavailable (e.g., private browsing), continue anyway
    }

    // Apply dark mode class to html element for Tailwind
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [mode]);

  const toggleTheme = () => setMode((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <ThemeModeContext.Provider value={{ toggleTheme, mode, setMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
};
