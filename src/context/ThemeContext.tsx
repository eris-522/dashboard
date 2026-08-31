import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColor = "gold" | "emerald" | "amber" | "rose" | "indigo";

export interface AccentOption {
  id: AccentColor;
  label: string;
  description: string;
  lightHex: string;
  darkHex: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  {
    id: "gold",
    label: "Champagne Gold",
    description: "Classic catering elegance and warmth",
    lightHex: "#b89047",
    darkHex: "#d4af37",
  },
  {
    id: "emerald",
    label: "Royal Emerald",
    description: "Lush botanical and garden receptions",
    lightHex: "#059669",
    darkHex: "#10b981",
  },
  {
    id: "amber",
    label: "Warm Amber",
    description: "Cozy bistro and rustic sunset events",
    lightHex: "#d97706",
    darkHex: "#f59e0b",
  },
  {
    id: "rose",
    label: "Velvet Rose",
    description: "Romantic banquets and anniversary galas",
    lightHex: "#e11d48",
    darkHex: "#f43f5e",
  },
  {
    id: "indigo",
    label: "Midnight Indigo",
    description: "Modern corporate and luxury galas",
    lightHex: "#4f46e5",
    darkHex: "#6366f1",
  },
];

interface ThemeContextType {
  theme: ThemeMode;
  themeMode: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (mode: ThemeMode) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  accentColor: AccentColor;
  setAccentColor: (accent: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem("theme_mode") as ThemeMode;
      if (saved === "light" || saved === "dark" || saved === "system") {
        return saved;
      }
    } catch (e) {
      console.error("Failed to read theme_mode from localStorage", e);
    }
    return "light";
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    try {
      const saved = localStorage.getItem("theme_accent") as AccentColor;
      if (["gold", "emerald", "amber", "rose", "indigo"].includes(saved)) {
        return saved;
      }
    } catch (e) {
      console.error("Failed to read theme_accent from localStorage", e);
    }
    return "gold";
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: "light" | "dark" =
    themeMode === "system" ? (systemIsDark ? "dark" : "light") : themeMode;

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [resolvedTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-accent", accentColor);
  }, [accentColor]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem("theme_mode", mode);
    } catch (e) {
      console.error("Failed to save theme_mode", e);
    }
  };

  const toggleTheme = () => {
    const nextMode = resolvedTheme === "dark" ? "light" : "dark";
    setThemeMode(nextMode);
  };

  const setAccentColor = (accent: AccentColor) => {
    setAccentColorState(accent);
    try {
      localStorage.setItem("theme_accent", accent);
    } catch (e) {
      console.error("Failed to save theme_accent", e);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: themeMode,
        themeMode,
        resolvedTheme,
        setTheme: setThemeMode,
        setThemeMode,
        toggleTheme,
        accentColor,
        setAccentColor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
