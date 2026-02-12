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
  const digits = value?.replace(/\D/g, "") ?? "";
  if (!digits) return "Card number is required";
  if (!/^\d+$/.test(digits)) return "Card number must contain only digits";
  if (!VALID_CARD_LENGTHS.includes(digits.length)) return "Card number must be 13, 15, 16, or 19 digits";
  if (!luhnCheck(digits)) return "Invalid card number";
  if (!hasValidCardPrefix(digits)) return "Card number not recognized";
  return true;
}
