"use client";

import { useEffect, useRef, useState } from "react";

type Theme = "acid" | "aqua";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "acid";
  const stored = localStorage.getItem("theme");
  if (stored === "aqua") return "aqua";
  return "acid";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("acid");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initial = getInitialTheme();
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggle = () => {
    const next = theme === "acid" ? "aqua" : "acid";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <label className="flex cursor-pointer gap-2">
      <input
        type="checkbox"
        className="toggle theme-controller border-pink-400 bg-amber-300 [--tglbg:var(--color-sky-500)] checked:border-cyan-800 checked:bg-cyan-300 checked:[--tglbg:var(--color-cyan-900)]"
        checked={theme === "aqua"}
        onChange={toggle}
      />
    </label>
  );
}
