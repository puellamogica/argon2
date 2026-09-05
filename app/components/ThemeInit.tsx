"use client";

import { useEffect } from "react";

export function ThemeInit() {
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const theme = stored === "aqua" ? "aqua" : "acid";
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return null;
}
