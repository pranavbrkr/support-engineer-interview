"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const themeInitScript = `
(function(){
  var t=localStorage.getItem('theme');
  var d=window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark',t==='dark'||(t!=='light'&&d));
})();
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nowDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", nowDark ? "dark" : "light");
    setIsDark(nowDark);
  };

  return (
    <>
      <Script id="theme-init" strategy="beforeInteractive">
        {themeInitScript}
      </Script>
      {children}
      {mounted && (
        <button
          type="button"
          onClick={toggleTheme}
          className="fixed top-4 right-4 z-50 px-3 py-2 text-sm font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          aria-label="Toggle dark mode"
        >
          {isDark ? "☀️ Light" : "🌙 Dark"}
        </button>
      )}
    </>
  );
}
