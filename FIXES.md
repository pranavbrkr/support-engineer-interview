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

## VAL-201: Email Validation Problems

### Problems

- **Silent lowercase conversion**: Signup used `z.string().email().toLowerCase()` on the server—emails like "TEST@example.com" were stored as "test@example.com" with no user notification.
- **Login/signup case mismatch**: Signup stored emails in lowercase, but login did not normalize input. Users who signed up with "Test@Example.com" could fail to log in with the same casing.
- **Client regex too permissive**: Both forms used `/^\S+@\S+$/i`, which accepted invalid addresses such as "a@b", "x@.con", and "test@@example.com".
- **No TLD typo validation**: Common typos like ".con", ".cmo", ".ocm" (for ".com") were not detected or rejected.

### Fixes

- **Shared email schema (server)**: Introduced an `emailSchema` in `auth.ts` that validates with Zod’s `.email()`, normalizes via `.toLowerCase().trim()`, and rejects common TLD typos via `.refine()`.
- **Consistent normalization**: Applied `emailSchema` to both signup and login so emails are always lowercased before storage and lookup.
- **Client validation**: Added `lib/validation.ts` with `validateEmail()` using a stricter regex and the same TLD typo list, used by both signup and login forms.
- **User notification**: Added the message "Emails are stored in lowercase (e.g. test@example.com)" under the signup email field to inform users about normalization.

## VAL-202: Date of Birth Validation

### Problems

- **Future dates accepted**: Users could select future dates (e.g. 2025) as date of birth with no server-side rejection.
- **No minimum age check**: There was no validation that the user was at least 18 years old, creating compliance risk for banking.
- **Invalid date strings accepted**: Server used `z.string()` and accepted any string (e.g. invalid dates or malformed values).
- **Client-side only required check**: The signup form only validated that the field was non-empty, with no past-date or age checks.

### Fixes

- **Server validation**: Added `dateOfBirthSchema` in `auth.ts` that validates YYYY-MM-DD format via regex, ensures a valid calendar date, rejects future dates, and requires the user to be at least 18 years old.
- **Client validation**: Added `validateDateOfBirth()` in `lib/validation.ts` with the same rules, used in the signup form's `register()`.
- **Date picker constraint**: Set `max={getMaxDateOfBirth()}` on the date input so the picker cannot select dates after 18 years ago.
- **Helper text**: Added "You must be at least 18 years old" under the date of birth field.

## VAL-206: Card Number Validation

### Problems

- **No Luhn checksum validation**: Card numbers were validated only by length (16 digits) and prefix (4 or 5). Numbers with invalid Luhn checksums (e.g. 4111111111111112) were accepted, causing failed transactions.
- **No server-side validation**: The `fundAccount` mutation accepted any string for `accountNumber` when type was "card"—client checks could be bypassed.
- **Narrow prefix check**: Only Visa (4) and Mastercard (5) prefixes were allowed, rejecting Amex, Discover, and other valid cards.
- **Length too strict**: Exactly 16 digits was required, rejecting Amex (15 digits).

### Fixes

- **Luhn algorithm**: Implemented Luhn (mod 10) checksum validation in `lib/validation.ts` to reject invalid card numbers.
- **Shared validation**: Added `validateCardNumber()` and `isValidCardNumber()` with format, length (13/15/16/19), Luhn, and network prefix checks (Visa, Mastercard, Amex, Discover).
- **Client validation**: Updated `FundingModal` to use `validateCardNumber()` when funding type is "card" instead of the old regex/prefix validation.
- **Server validation**: Added a Zod `.refine()` on `fundingSource` in `account.ts` that calls `isValidCardNumber()` when type is "card".
