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

## VAL-205: Zero Amount Funding

### Problems

- **Client allowed $0.00**: The amount input used `min: 0.0`, which accepts values ≥ 0, so $0.00 passed validation. Users could submit and then see a server error instead of an inline form message.
- **Misleading validation**: The error message said "Amount must be at least $0.01" but the rule allowed 0.

### Fixes

- **Client validation**: Changed `min` from `0.0` to `0.01` in `FundingModal` so zero-amount submissions are rejected with an inline error before the request is sent.

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

## VAL-210: Card Type Detection

### Problems

- **Narrow prefix check**: Original validation only accepted Visa (4) and Mastercard (5), rejecting Amex, Discover, and other valid cards.
- **Length too strict**: Exactly 16 digits was required, rejecting Amex (15 digits).

### Fixes

- **Resolved as part of VAL-206**: The card validation added in VAL-206 includes full card type detection for Visa, Mastercard, Amex, and Discover, with appropriate lengths (13, 15, 16, 19 digits). No additional changes required.

## VAL-207: Routing Number Optional

### Problems

- **No server-side enforcement**: The `fundAccount` mutation used `routingNumber: z.string().optional()`. Bank transfers could be submitted without a routing number via direct API calls (e.g. Postman), bypassing client validation.
- **Failed ACH transfers**: Bank transfers without routing numbers would fail at the ACH processor, causing support issues and customer confusion.

### Fixes

- **Server validation**: Added a second `.refine()` on the `fundingSource` schema that, when `type === "bank"`, requires `routingNumber` to be present and exactly 9 digits. Requests without a valid routing number are now rejected with a clear error message.

## VAL-208: Weak Password Requirements

### Problems

- **Server only checked length**: Signup used `z.string().min(8)`, allowing weak passwords like "aaaaaaaa" or "12345678" via direct API calls.
- **Missing complexity rules**: No requirements for uppercase, lowercase, or special characters. Passwords like "Password1" (no special char) or "password123" were accepted.
- **Tiny common-password list**: Only 3 entries ("password", "12345678", "qwerty"); variations like "password1", "password123" passed.
- **Inconsistent validation**: Client had partial checks; server could be bypassed via API.

### Fixes

- **Shared validation**: Added `validatePassword()` and `isValidPassword()` in `lib/validation.ts` requiring 8+ chars, uppercase, lowercase, digit, special character, and an expanded common-password blocklist.
- **Server validation**: Replaced `z.string().min(8)` with `passwordSchema` using `isValidPassword()` in `auth.ts` signup input.
- **Client validation**: Updated signup form to use `validatePassword()` instead of inline rules.

## SEC-301: SSN Storage

### Problems

- **Plaintext storage**: SSNs were stored unencrypted in the database; a DB breach would expose all SSNs.
- **API exposure**: Signup/login responses included the full user object with SSN via `...user`.
- **Compliance risk**: PCI-DSS, GLBA, and similar frameworks require protection of SSNs.

### Fixes

- **Hash before storage**: SSN is now hashed with bcrypt (same as passwords) before `db.insert` in the signup flow.
- **Exclude from responses**: Signup and login return a safe user object that omits both `password` and `ssn` via destructuring.

### Migration for Existing Data

- **One-way hashing**: Because bcrypt is one-way, existing plaintext SSNs cannot be hashed in place.
- **Development**: Run `npm run db:clear` to wipe the database; all new signups will store hashed SSNs.
- **Production**: A proper migration would require users to re-verify their SSN (e.g. through a secure flow), or accept the risk for legacy records until they re-engage.

## SEC-302: Insecure Random Numbers

### Problems

- **Math.random() for account numbers**: `generateAccountNumber()` in `account.ts` used `Math.floor(Math.random() * 1000000000)` to generate 10-digit account numbers.
- **Predictable PRNG**: `Math.random()` is a pseudo-random number generator (e.g. xorshift128+) that is not cryptographically secure. Its output can be predicted given enough observations or knowledge of internal state.
- **Security-sensitive identifier**: Account numbers are long-lived identifiers; predictability increases the risk of enumeration or guessing attacks.

### Fixes

- **Cryptographically secure RNG**: Replaced `Math.random()` with Node.js `crypto.randomInt(0, 1_000_000_000)` from the `node:crypto` module.
- **Unchanged behavior**: The uniqueness loop (`while (!isUnique)`) remains in place to handle the extremely rare case of collision.
- **Unit tests**: Added `server/routers/account.test.ts` to assert that generated account numbers are 10 digits and that successive calls produce different values.

## SEC-303: XSS Vulnerability

### Problems

- **dangerouslySetInnerHTML on transaction descriptions**: `TransactionList.tsx` rendered `transaction.description` with `dangerouslySetInnerHTML`, executing any HTML or JavaScript in the string instead of displaying it as text.
- **XSS risk**: If descriptions ever contained user-controlled or untrusted content (e.g. from future features, legacy data, or DB compromise), attackers could inject and execute scripts in other users' browsers.
- **Unnecessary use**: Descriptions are plain text (e.g. "Funding from card"); HTML rendering was not required.

### Fixes

- **Safe text rendering**: Replaced `dangerouslySetInnerHTML` with standard JSX interpolation `{transaction.description ?? "-"}`, so React escapes the value and treats it as text.

## SEC-304: Session Management

### Problems

- **Multiple valid sessions per user**: Every signup and login created a new session without removing existing ones. Users could accumulate many active sessions across devices.
- **No invalidation**: There was no way to revoke sessions (e.g. lost device or suspected compromise). Stolen sessions remained valid until expiry (7 days).
- **Security risk**: Unauthorized access from compromised sessions could not be remediated.

### Fixes

- **Single session per user**: On signup and login, all existing sessions for that user are deleted before creating the new session. Only one active session is allowed at a time; logging in elsewhere logs out the previous device.
- **logoutAll procedure**: Added a protected mutation `auth.logoutAll` that deletes all sessions for the current user and clears the session cookie, logging the user out everywhere including the current device. Enables a future "Log out from all devices" UI.

## PERF-401: Account Creation Error

### Problems

- **Fake fallback on fetch failure**: After inserting a new account, `createAccount` fetched it from the DB. If the fetch returned null (e.g. rare DB glitch), the code returned a hardcoded fallback object with `balance: 100` and `status: "pending"`.
- **Incorrect balance display**: Users could see a $100 balance for an account that either wasn't created or couldn't be retrieved, causing confusion and support issues.

### Fixes

- **Remove fake fallback**: When the fetch returns null after a successful insert, throw a `TRPCError` with code `INTERNAL_SERVER_ERROR` and a clear message instead of returning fabricated data.

## PERF-405: Missing Transactions

### Problems

- **Stale cache after funding**: When a user funded an account, the dashboard refetched accounts (balances) but did not invalidate the `getTransactions` query. The transaction list kept showing cached data, so new transactions did not appear until the cache expired or the user navigated away and back.
- **Impact**: Users could not verify all their transactions after multiple funding events.

### Fixes

- **Invalidate transactions on funding success**: In the dashboard's FundingModal `onSuccess` handler, call `utils.account.getTransactions.invalidate({ accountId })` so the transaction list refetches and displays new transactions immediately.
- **Consistent invalidation**: Replaced `refetchAccounts()` with `utils.account.getAccounts.invalidate()` in the funding success flow for consistency with the query invalidation pattern.
