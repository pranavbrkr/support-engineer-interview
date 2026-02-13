/**
 * Shared validation helpers (mirrors server validation for consistency)
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const COMMON_TLD_TYPOS = [".con", ".cmo", ".ocm", ".comm", ".coom", ".comn"];

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function hasCommonTldTypo(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return COMMON_TLD_TYPOS.some((typo) => domain.endsWith(typo));
}

export function validateEmail(value: string): true | string {
  if (!value?.trim()) return "Email is required";
  if (!isValidEmail(value)) return "Invalid email address";
  if (hasCommonTldTypo(value)) return "Please check your email domain (e.g. .com instead of .con)";
  return true;
}

// US state codes (50 states + DC) - USPS abbreviations
const VALID_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA",
  "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR",
  "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

export function isValidState(value: string): boolean {
  return VALID_STATE_CODES.has(value?.trim().toUpperCase());
}

export function validateState(value: string): true | string {
  if (!value?.trim()) return "State is required";
  const code = value.trim().toUpperCase();
  if (code.length !== 2) return "Use 2-letter state code (e.g. CA)";
  if (!VALID_STATE_CODES.has(code)) return "Invalid state code. Use 2-letter US state abbreviation (e.g. CA, NY)";
  return true;
}

const AMOUNT_FORMAT_REGEX = /^\d+\.?\d{0,2}$/;
const AMOUNT_LEADING_ZEROS_REGEX = /^0+\d/; // matches 01, 001, 010.50

export function validateAmountInput(value: string): true | string {
  if (!value?.trim()) return "Amount is required";
  const trimmed = value.trim();
  if (!AMOUNT_FORMAT_REGEX.test(trimmed)) return "Invalid amount format (e.g. 10.00)";
  if (AMOUNT_LEADING_ZEROS_REGEX.test(trimmed)) return "Avoid leading zeros (use 10.00 not 010.00)";
  const num = parseFloat(trimmed);
  if (num < 0.01) return "Amount must be at least $0.01";
  if (num > 10000) return "Amount cannot exceed $10,000";
  return true;
}

// E.164: +[country code 1-9][number], total 8-15 digits after +
const PHONE_E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function isValidPhoneNumber(value: string): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  // Accept E.164 (+1234567890) or 10-digit US local (5551234567 -> +15551234567)
  if (PHONE_E164_REGEX.test(trimmed)) return true;
  if (/^\d{10}$/.test(trimmed)) return true; // US without country code
  return false;
}

export function validatePhoneNumber(value: string): true | string {
  if (!value?.trim()) return "Phone number is required";
  const trimmed = value.trim();
  if (PHONE_E164_REGEX.test(trimmed)) return true;
  if (/^\d{10}$/.test(trimmed)) return true;
  if (!/^\+?\d+$/.test(trimmed)) return "Phone number must contain only digits (use + for international, e.g. +15551234567)";
  if (trimmed.length < 10 || trimmed.length > 15) return "Phone number must be 10-15 digits (e.g. +15551234567 for US)";
  return "Use E.164 format with country code (e.g. +15551234567 for US)";
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MINIMUM_AGE = 18;

function isValidDateFormat(value: string): boolean {
  return DATE_REGEX.test(value.trim());
}

function isValidCalendarDate(value: string): boolean {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function isDateInPast(value: string): boolean {
  const birthDate = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  birthDate.setHours(0, 0, 0, 0);
  return birthDate <= today;
}

function isAtLeast18(value: string): boolean {
  const birthDate = new Date(value);
  const today = new Date();
  const minBirthDate = new Date(today);
  minBirthDate.setFullYear(minBirthDate.getFullYear() - MINIMUM_AGE);
  return birthDate <= minBirthDate;
}

export function validateDateOfBirth(value: string): true | string {
  if (!value?.trim()) return "Date of birth is required";
  if (!isValidDateFormat(value)) return "Invalid date format (use YYYY-MM-DD)";
  if (!isValidCalendarDate(value)) return "Invalid date";
  if (!isDateInPast(value)) return "Date of birth cannot be in the future";
  if (!isAtLeast18(value)) return `You must be at least ${MINIMUM_AGE} years old to open an account`;
  return true;
}

export function getMaxDateOfBirth(): string {
  const today = new Date();
  const maxDate = new Date(today);
  maxDate.setFullYear(maxDate.getFullYear() - MINIMUM_AGE);
  return maxDate.toISOString().slice(0, 10);
}

// Password validation (complexity requirements)
const MIN_PASSWORD_LENGTH = 8;
const COMMON_PASSWORDS = new Set([
  "password",
  "12345678",
  "123456789",
  "qwerty",
  "qwerty123",
  "password1",
  "password123",
  "admin",
  "letmein",
  "welcome",
  "monkey",
  "dragon",
  "master",
  "abc123",
  "111111",
  "1234567",
  "sunshine",
  "princess",
  "football",
  "iloveyou",
  "admin123",
  "welcome1",
  "changeme",
]);

export function isValidPassword(password: string): boolean {
  if (!password || password.length < MIN_PASSWORD_LENGTH) return false;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return false;
  return true;
}

export function validatePassword(value: string): true | string {
  if (!value) return "Password is required";
  if (value.length < MIN_PASSWORD_LENGTH) return "Password must be at least 8 characters";
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return "Password is too common";
  if (!/[A-Z]/.test(value)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(value)) return "Password must contain at least one lowercase letter";
  if (!/\d/.test(value)) return "Password must contain at least one number";
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value))
    return "Password must contain at least one special character (!@#$%^&*...)";
  return true;
}

// Card validation (Luhn algorithm + format)
const VALID_CARD_LENGTHS = [13, 15, 16, 19];

const CARD_PREFIXES: RegExp[] = [
  /^4/, // Visa
  /^5[1-5]/, // Mastercard
  /^3[47]/, // Amex
  /^6011/, // Discover
  /^65/, // Discover
  /^64[4-9]/, // Discover
  /^622(?:1(?:2[6-9]|[3-9]\d)|[2-8]\d{2}|9[0-2][0-5])/, // Discover 622126-622925
];

function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "").split("").map(Number).reverse();
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = digits[i];
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

function hasValidCardPrefix(cardNumber: string): boolean {
  return CARD_PREFIXES.some((re) => re.test(cardNumber));
}

export function isValidCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (!/^\d+$/.test(digits)) return false;
  if (!VALID_CARD_LENGTHS.includes(digits.length)) return false;
  if (!luhnCheck(digits)) return false;
  if (!hasValidCardPrefix(digits)) return false;
  return true;
}

export function validateCardNumber(value: string): true | string {
  const raw = value?.trim() ?? "";
  if (!raw) return "Card number is required";
  if (/[a-zA-Z]/.test(raw)) return "Card number must contain only digits";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "Card number is required";
  if (!VALID_CARD_LENGTHS.includes(digits.length)) return "Card number must be 13, 15, 16, or 19 digits";
  if (!luhnCheck(digits)) return "Invalid card number";
  if (!hasValidCardPrefix(digits)) return "Card number not recognized";
  return true;
}
