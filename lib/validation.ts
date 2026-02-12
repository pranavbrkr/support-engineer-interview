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
