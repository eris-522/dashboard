import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColor = "gold" | "emerald" | "amber" | "rose" | "indigo";

export interface AccentOption {
  id: AccentColor;
  label: string;
  lightHex: string;
  darkHex: string;
  description: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  {
    id: "gold",
    label: "Signature Gold",
    lightHex: "#a68a56",
    darkHex: "#c4a96e",
    description: "Classic Roxan Policarpio warm ivory & gold editorial aesthetic",
  },
  {
    id: "emerald",
    label: "Sage Emerald",
    lightHex: "#2e7d32",
    darkHex: "#4caf50",
    description: "Organic, fresh botanical elegance for catering & garden events",
  },
  {
    id: "amber",
    label: "Sunset Amber",
    lightHex: "#b45309",
    darkHex: "#f59e0b",
    description: "Warm, inviting rustic bronze tone with vibrant accents",
  },
  {
    id: "rose",
    label: "Vintage Rose",
    lightHex: "#9e2a2b",
    darkHex: "#f472b6",
    description: "Romantic, refined rosewood tone ideal for weddings & galas",
  },
  {
    id: "indigo",
    label: "Midnight Indigo",
    lightHex: "#3949ab",
    darkHex: "#818cf8",
    description: "Modern, sophisticated corporate and executive atmosphere",
  },
];

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  accentColor: AccentColor;
  setTheme: (theme: ThemeMode) => void;
  setAccentColor: (accent: AccentColor) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "rp_admin_theme_mode";
const ACCENT_STORAGE_KEY = "rp_admin_theme_accent";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") {
        return saved;
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return "system";
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    try {
      const saved = localStorage.getItem(ACCENT_STORAGE_KEY) as AccentColor;
      if (ACCENT_OPTIONS.some((opt) => opt.id === saved)) {
        return saved;
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return "gold";
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  // Listen to OS system color scheme changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemIsDark ? "dark" : "light") : theme;

  // Apply theme class and data attributes to HTML root element
  useEffect(() => {
    const root = document.documentElement;

    if (resolvedTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }

    root.setAttribute("data-theme", resolvedTheme);
    root.setAttribute("data-accent", accentColor);
    root.style.colorScheme = resolvedTheme;

    // Update meta color-scheme
    let metaTag = document.querySelector('meta[name="color-scheme"]');
    if (!metaTag) {
      metaTag = document.createElement("meta");
      metaTag.setAttribute("name", "color-scheme");
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute("content", resolvedTheme);
  }, [resolvedTheme, accentColor]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {
      console.error("Failed to save theme to localStorage:", e);
    }
  };

  const setAccentColor = (newAccent: AccentColor) => {
    setAccentColorState(newAccent);
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, newAccent);
    } catch (e) {
      console.error("Failed to save accent to localStorage:", e);
    }
  };

  const toggleTheme = () => {
    if (resolvedTheme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        accentColor,
        setTheme,
        setAccentColor,
        toggleTheme,
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

