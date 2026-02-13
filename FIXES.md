# Bug Fixes Documentation

This document records bugs identified in the SecureBank application (from `CHALLENGE.md`), documenting for each bug: **what caused it**, **how the fix resolves it**, and **what preventive measures can avoid similar issues**. Each entry is organized by ticket ID.

---

## UI-101: Dark Mode Text Visibility

### Root cause

Form elements relied on inherited styles and browser defaults instead of explicit light/dark values. The app used `prefers-color-scheme` (system-only) and hardcoded light Tailwind classes (`bg-white`, `bg-gray-50`) that override the root dark mode. There was no explicit styling for form controls in dark mode, so inputs inherited body styles and appeared white-on-white.

### How the fix resolves it

- **Input visibility**: In `globals.css`, added explicit `color` and `background-color` for `input`, `textarea`, and `select` in both light and dark modes (e.g. dark: `#e5e5e5` text on `#262626` background).
- **Page backgrounds**: Added Tailwind `dark:` variants (e.g. `dark:bg-gray-900`) so sections respect dark mode.
- **Theme toggle**: Switched to class-based dark mode (`@custom-variant dark`) and a `ThemeProvider` that toggles the `dark` class on `<html>`, persists in `localStorage`, and falls back to system preference. Users can override system theme.
- **Hydration**: Set `suppressHydrationWarning` on `<html>` so the theme script can run before hydration without mismatch.

### Preventive measures

- Use explicit colors for form controls; avoid relying on inheritance in theme-aware UIs.
- Define light/dark tokens in `globals.css` and reference them consistently.
- Add dark-mode checks to visual regression or E2E tests.

## VAL-201: Email Validation Problems

### Root cause

Server normalized emails with `.toLowerCase()` without informing users; login did not normalize input, so case differences caused login failures. The client used a loose regex (`/^\S+@\S+$/i`) that accepted invalid formats. No TLD typo detection existed for common mistakes like ".con" instead of ".com".

### How the fix resolves it

- **Shared email schema**: Introduced `emailSchema` in `auth.ts` that validates with Zod `.email()`, normalizes via `.toLowerCase().trim()`, and rejects common TLD typos via `.refine()`.
- **Consistent normalization**: Applied `emailSchema` to both signup and login so storage and lookup always use normalized emails; users can log in regardless of casing.
- **Client validation**: Added `validateEmail()` in `lib/validation.ts` with stricter regex and same typo list; both forms use it.
- **User notification**: Displayed "Emails are stored in lowercase (e.g. test@example.com)" under the signup email field so users understand normalization.

### Preventive measures

- Use a shared validation layer (e.g. `lib/validation.ts`) for client and server so rules stay in sync.
- Normalize identifiers (emails, phone numbers) at write and read boundaries and document behavior to users.
- Maintain a small allowlist/blocklist for common typos and validate against it.

## VAL-202: Date of Birth Validation

### Root cause

The server used `z.string()` with no format or business-rule checks, so invalid and future dates were accepted. The client only enforced non-empty. There was no enforcement of past dates or a minimum age (18+), leading to compliance risk.

### How the fix resolves it

- **Server validation**: Added `dateOfBirthSchema` in `auth.ts` to validate YYYY-MM-DD format, require a valid calendar date, reject future dates, and ensure the user is at least 18 years old.
- **Client validation**: Added `validateDateOfBirth()` in `lib/validation.ts` with the same rules; signup form uses it in `register()`.
- **Date picker constraint**: Set `max={getMaxDateOfBirth()}` so the picker cannot select dates after the 18-year cutoff.
- **Helper text**: Added "You must be at least 18 years old" under the field.

### Preventive measures

- Validate dates on both client and server; never trust client-only checks for compliance rules.
- Use date schemas that verify format, validity, and business rules (past date, age limits).
- Constrain date inputs (min/max) so invalid options are not selectable.

## VAL-206: Card Number Validation

### Root cause

Validation used only length and prefix, without a Luhn checksum, so invalid numbers (e.g. 4111111111111112) passed. Server did not validate card numbers, so direct API calls could bypass client checks. Prefix and length rules were too narrow, rejecting valid Amex (15 digits) and other networks.

### How the fix resolves it

- **Luhn checksum**: Implemented Luhn (mod 10) validation in `lib/validation.ts` to reject invalid card numbers.
- **Shared validation**: Added `validateCardNumber()` and `isValidCardNumber()` with format, length (13/15/16/19), Luhn, and network prefix checks (Visa, Mastercard, Amex, Discover).
- **Client validation**: FundingModal uses `validateCardNumber()` instead of the old regex/prefix validation.
- **Server validation**: Added Zod `.refine()` on `fundingSource` in `account.ts` that calls `isValidCardNumber()` when type is "card", preventing bypass via API.

### Preventive measures

- Always validate sensitive payment data on the server; treat client validation as UX only.
- Use industry-standard validation (e.g. Luhn) for card numbers.
- Support multiple card networks and lengths (Visa, Mastercard, Amex, Discover).

## VAL-207: Routing Number Optional

### Root cause

The `fundAccount` schema used `routingNumber: z.string().optional()`, so bank transfers could be submitted without a routing number via direct API calls. Client validation could be bypassed, leading to failed ACH transfers.

### How the fix resolves it

Added a second `.refine()` on the `fundingSource` schema that, when `type === "bank"`, requires `routingNumber` to be present and exactly 9 digits. Requests without a valid routing number are rejected with a clear error message.

### Preventive measures

- Make conditional required fields explicit in the schema (e.g. routing number when type is bank).
- Validate all payment-related inputs on the server; never rely on client-only checks for backend flows.

## VAL-205: Zero Amount Funding

### Root cause

The amount input used `min: 0.0`, which accepts values ≥ 0. The error message claimed "Amount must be at least $0.01" but the rule allowed $0.00, so users could submit zero and receive a server error instead of an inline message.

### How the fix resolves it

Changed `min` from `0.0` to `0.01` in the FundingModal amount validation so zero-amount submissions are rejected with an inline error before the request is sent.

### Preventive measures

- Ensure validation rules match error messages; avoid misleading copy.
- Reject invalid values at the client for immediate feedback; server should also enforce for defense in depth.

## VAL-208: Weak Password Requirements

### Root cause

Server used only `z.string().min(8)`, with no complexity rules or blocklist. A small common-password list allowed variations like "password123". Client had partial checks; server could be bypassed via direct API calls.

### How the fix resolves it

- **Shared validation**: Added `validatePassword()` and `isValidPassword()` in `lib/validation.ts` requiring 8+ chars, uppercase, lowercase, digit, special character, and an expanded common-password blocklist.
- **Server validation**: Replaced `z.string().min(8)` with `passwordSchema` using `isValidPassword()` in `auth.ts` signup input.
- **Client validation**: Signup form uses `validatePassword()` instead of inline rules.

### Preventive measures

- Enforce password policy on the server; client validation is for UX only.
- Use a shared validation module to keep client and server rules consistent.
- Maintain and regularly update a common-password blocklist.

## VAL-210: Card Type Detection

### Root cause

Original validation only accepted Visa (4) and Mastercard (5) prefixes with exactly 16 digits, rejecting valid Amex (15 digits) and Discover cards.

### How the fix resolves it

Resolved as part of VAL-206: the card validation now includes full card type detection for Visa, Mastercard, Amex, and Discover, with appropriate lengths (13, 15, 16, 19 digits). No additional changes were required.

### Preventive measures

- Support multiple card networks and their length rules.
- Use a shared validation module for consistency and easier updates.

## SEC-301: SSN Storage

### Root cause

SSNs were stored in plaintext in the database, and signup/login responses spread the full user object (`...user`), exposing SSN and password in API responses. No hashing or redaction was applied.

### How the fix resolves it

- **Hash before storage**: SSN is now hashed with bcrypt (same as passwords) before `db.insert` in the signup flow.
- **Exclude from responses**: Signup and login return a safe user object that omits both `password` and `ssn` via destructuring.

### Preventive measures

- Never store PII (SSN, full card numbers) in plaintext; use one-way hashing or encryption where appropriate.
- Never spread full user/entity objects in API responses; explicitly select safe fields to return.
- Follow compliance guidelines (GLBA, PCI-DSS) for handling sensitive data.

### Migration for Existing Data

- **One-way hashing**: Because bcrypt is one-way, existing plaintext SSNs cannot be hashed in place.
- **Development**: Run `npm run db:clear` to wipe the database; all new signups will store hashed SSNs.
- **Production**: A proper migration would require users to re-verify their SSN (e.g. through a secure flow), or accept the risk for legacy records until they re-engage.

## SEC-302: Insecure Random Numbers

### Root cause

`generateAccountNumber()` used `Math.floor(Math.random() * 1000000000)`. `Math.random()` is a non-cryptographic PRNG whose output can be predicted; using it for security-sensitive identifiers (account numbers) created enumeration risk.

### How the fix resolves it

- **Cryptographically secure RNG**: Replaced `Math.random()` with Node.js `crypto.randomInt(0, 1_000_000_000)` from the `node:crypto` module.
- **Unchanged behavior**: The uniqueness loop (`while (!isUnique)`) remains in place to handle the extremely rare case of collision.
- **Unit tests**: Added `server/routers/account.test.ts` to assert that generated account numbers are 10 digits and that successive calls produce different values.

### Preventive measures

- Use `crypto.randomInt()`, `crypto.randomBytes()`, or equivalent for security-sensitive identifiers (tokens, account numbers, salts).
- Never use `Math.random()` for anything security-related.

## SEC-303: XSS Vulnerability

### Root cause

`TransactionList.tsx` rendered `transaction.description` with `dangerouslySetInnerHTML`, which executes any HTML/JS in the string. Although descriptions were system-generated, any future user-controlled or DB-compromised content could have enabled XSS.

### How the fix resolves it

Replaced `dangerouslySetInnerHTML` with standard JSX interpolation `{transaction.description ?? "-"}`, so React escapes the value and renders it as plain text.

### Preventive measures

- Avoid `dangerouslySetInnerHTML`; use React's default escaping unless HTML is strictly required.
- If HTML rendering is needed, use a sanitization library (e.g. DOMPurify) and a content-security policy.

## SEC-304: Session Management

### Root cause

Each signup/login created a new session without removing existing ones, so users could have many active sessions. There was no way to revoke sessions; stolen or lost-device sessions remained valid until expiry.

### How the fix resolves it

- **Single session per user**: On signup and login, all existing sessions for that user are deleted before creating the new session. Logging in elsewhere logs out the previous device.
- **logoutAll procedure**: Added `auth.logoutAll` mutation that deletes all sessions for the current user and clears the session cookie, enabling "Log out from all devices".

### Preventive measures

- Design session policy explicitly (single vs multi-device); delete old sessions when creating new ones if single-session is desired.
- Provide a revocation mechanism (logout all, revoke by device) for security incidents.

## PERF-401: Account Creation Error

### Root cause

After inserting a new account, `createAccount` fetched it from the DB. If the fetch returned null, the code returned a hardcoded fallback with `balance: 100` and `status: "pending"`, displaying fake data instead of surfacing the error.

### How the fix resolves it

When the fetch returns null after a successful insert, the code now throws a `TRPCError` with code `INTERNAL_SERVER_ERROR` and a clear message instead of returning fabricated data.

### Preventive measures

- Avoid returning fabricated or fallback data on errors; surface failures so users and support can act.
- Fail fast and log errors instead of masking them with fake success states.

## PERF-405: Missing Transactions

### Root cause

When a user funded an account, the dashboard invalidated `getAccounts` but not `getTransactions`. The transaction list kept showing cached data; new transactions appeared only after cache expiry or navigation.

### How the fix resolves it

In the FundingModal `onSuccess` handler, call `utils.account.getTransactions.invalidate({ accountId })` and `utils.account.getAccounts.invalidate()` so both balances and transaction list refetch immediately after funding.

### Preventive measures

- When a mutation affects query data, invalidate all related queries so the UI stays in sync.
- Document cache invalidation patterns for mutations (which queries each mutation invalidates).

## PERF-406: Balance Calculation

### Root cause

JavaScript floats cause rounding drift with repeated additions. The code also used a loop that added `amount / 100` 100 times, amplifying float errors, and the DB update and response used different calculations that could diverge.

### How the fix resolves it

- **Remove erroneous loop**: Replaced the loop with direct `account.balance + amount` for both the DB update and the returned `newBalance`.
- **Round to 2 decimals**: Use `Math.round((account.balance + amount) * 100) / 100` to keep amounts to 2 decimals and limit drift.

### Preventive measures

- Avoid float arithmetic for money where possible; consider integer cents or a decimal library.
- Round financial values at write and display boundaries.

## PERF-408: Resource Leak

### Root cause

`initDb()` created an extra connection `conn` and pushed it into a `connections` array, but schema creation used the existing `sqlite` connection. The extra `conn` was never closed, leaking resources.

### How the fix resolves it

- **Remove redundant connection**: Removed the `conn` creation and `connections` array; schema creation uses only the main `sqlite` connection.
- **Add closeDb()**: Exported `closeDb()` to close the main SQLite connection for graceful shutdown (e.g. in tests or on process exit).

### Preventive measures

- Avoid creating unused resources; remove dead code and connections.
- Provide shutdown/cleanup functions for tests and graceful process exit.

## PERF-402: Logout Issues

### Root cause

Logout tried to delete the session by token from the cookie. If cookie parsing failed or the token was missing, the session was never deleted, but the response still returned "Logged out successfully", so users believed they were logged out when the session remained active.

### How the fix resolves it

When `ctx.user` exists, delete the session by `ctx.user.id` instead of by token. This reliably removes the session even when the cookie cannot be parsed or is missing.

### Preventive measures

- Prefer stable identifiers (userId) over transient ones (token) for DB lookups when the user context is available.
- Ensure success responses match actual side effects; avoid reporting success when operations fail silently.

## PERF-403: Session Expiry

### Root cause

The check `new Date(session.expiresAt) > new Date()` treated sessions as valid up to the exact expiry moment, with no buffer for clock skew. Sessions could remain valid slightly past intended expiry.

### How the fix resolves it

Added a 1-minute buffer: sessions are considered expired if they expire within the next minute (`expiresAt - 1 min <= now`). Provides tighter security while allowing a small buffer for clock skew.

### Preventive measures

- Add a buffer when comparing expiry timestamps to account for clock skew and processing delay.

## PERF-404: Transaction Sorting

### Root cause

`getTransactions` had no `orderBy` clause, so the database returned transactions in arbitrary order (e.g. insertion order or physical layout), making history appear random.

### How the fix resolves it

Added `.orderBy(desc(transactions.createdAt), desc(transactions.id))` so transactions are returned newest-first, matching typical expectations.

### Preventive measures

- Always specify explicit ordering for list/query endpoints; do not rely on implicit DB order.

## PERF-407: Performance Degradation

### Root cause

For each transaction, `getTransactions` ran a separate DB query to fetch account details. All transactions belonged to the same account (filtered by `accountId`), so the same account was fetched repeatedly—N+1 queries for N transactions.

### How the fix resolves it

The account was already loaded for authorization. Reuse `account.accountType` instead of querying in the loop. Reduced from 1 + N queries to 2 queries total (account + transactions).

### Preventive measures

- Avoid N+1 queries: fetch related data once outside loops or use joins/batching.
- Profile queries under realistic loads; add integration tests for list endpoints.

## VAL-203: State Code Validation

### Root cause

Server and client only validated length and format (`/^[A-Z]{2}$/`), so any two letters (e.g. "XX", "ZZ") were accepted. There was no allowlist of valid US state codes.

### How the fix resolves it

- **US state allowlist**: Added `isValidState()` and `validateState()` in `lib/validation.ts` with a whitelist of valid USPS 2-letter codes (50 states + DC).
- **Server and client**: Auth router uses `stateSchema` with `.refine(isValidState)`; signup form uses `validate: validateState`.

### Preventive measures

- Use allowlists for constrained inputs (state codes, country codes, currencies); avoid format-only validation.

## VAL-204: Phone Number Format

### Root cause

Server accepted `/^\+?\d{10,15}$/` while client only allowed `/^\d{10}$/`, so international numbers like `+15551234567` failed on the client. No E.164 or country-code structure was enforced.

### How the fix resolves it

- **Shared E.164-style validation**: Added `isValidPhoneNumber()` and `validatePhoneNumber()` in `lib/validation.ts`. Accepts E.164 format or 10-digit US numbers.
- **Normalization**: Server transforms 10-digit US input to `+1` prefix for consistent storage.
- **Aligned client and server**: Both use the shared validation; international numbers work on client and server.

### Preventive measures

- Align client and server validation rules; use a shared validation module.
- Normalize phone numbers at the boundary for consistent storage and display.

## VAL-209: Amount Input Leading Zeros

### Root cause

The amount input accepted any numeric string matching the format regex; no check rejected amounts with unnecessary leading zeros (e.g. `00010.00`, `01`), causing confusion and inconsistent currency display.

### How the fix resolves it

- **Shared validator**: Added `validateAmountInput()` in `lib/validation.ts` that rejects amounts with leading zeros (via `/^0+\d/`), validates format (up to 2 decimals), and enforces $0.01–$10,000 range.
- **Client validation**: Replaced FundingModal amount `pattern`/`min`/`max` with `validate: validateAmountInput`.
- **Server validation**: `fundAccount` accepts both string and number; string amounts are validated with `validateAmountInput` before parsing, rejecting leading zeros via direct API calls.

### Preventive measures

- Validate input format and semantics (e.g. reject leading zeros) on both client and server.
