# Bug Fixes Documentation

## UI-101: Dark Mode Text Visibility

### Problems

- **Input text invisible in forms**: Form inputs (`input`, `textarea`, `select`) had no explicit `color` or `background-color`. They inherited from the body and relied on browser defaults, which resulted in poor contrast—especially white text on a white background in dark mode.
- **Page backgrounds stuck in light mode**: Login, signup, and dashboard pages used hardcoded Tailwind classes (`bg-gray-50`, `bg-white`) that override the body background. Dark mode never applied to these sections.
- **Theme driven by OS only**: The app used `prefers-color-scheme`, which only reacts to system settings. Changing the IDE or browser theme did not update the page, since the app had no in-app theme control.

### Fixes

- **Input visibility**: In `globals.css`, added explicit styles for `input`, `textarea`, and `select`:
  - Light mode: `color: #171717`, `background-color: #ffffff`
  - Dark mode: `color: #e5e5e5`, `background-color: #262626`, `border-color: #4b5563`
- **Page backgrounds**: Updated login, signup, and dashboard pages with Tailwind `dark:` variants (e.g., `bg-gray-50 dark:bg-gray-900`) for main wrappers, cards, and text.
- **Theme toggle**: Switched from `prefers-color-scheme` to class-based dark mode using `@custom-variant dark` in `globals.css`. Added a `ThemeProvider` with a fixed toggle button that sets the `dark` class on `<html>`, persists choice in `localStorage`, and falls back to system preference when no preference is stored.
- **Hydration mismatch**: Set `suppressHydrationWarning` on the `<html>` element because the theme script updates the DOM before React hydrates, which would otherwise cause a server/client markup mismatch.
