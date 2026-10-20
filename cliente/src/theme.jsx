import { createContext, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const ThemeContext = createContext(null);
const storageKey = "hey-chat-theme";
function initialTheme() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* The toggle still works when storage is unavailable. */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
const startingTheme = initialTheme();
document.documentElement.dataset.theme = startingTheme;

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(startingTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(storageKey, theme); } catch { /* Optional persistence. */ }
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, toggle: () => setTheme(value => value === "dark" ? "light" : "dark") }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { theme, toggle } = useContext(ThemeContext);
  const dark = theme === "dark";
  const label = dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
    {dark ? <Sun size={18} /> : <Moon size={18} />}
    <span>{dark ? "Claro" : "Oscuro"}</span>
  </button>;
}
