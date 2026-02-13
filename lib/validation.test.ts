import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validateDateOfBirth,
  getMaxDateOfBirth,
  validatePassword,
  isValidPassword,
  validateCardNumber,
  isValidCardNumber,
  validateAmountInput,
} from "./validation";

describe("validateEmail", () => {
  it("accepts valid email", () => {
    expect(validateEmail("test@example.com")).toBe(true);
    expect(validateEmail("user.name+tag@domain.co.uk")).toBe(true);
  });

  it("rejects empty email", () => {
    expect(validateEmail("")).toBe("Email is required");
    expect(validateEmail("   ")).toBe("Email is required");
  });

  it("rejects invalid format", () => {
    expect(validateEmail("a@b")).toBe("Invalid email address");
    expect(validateEmail("invalid")).toBe("Invalid email address");
    expect(validateEmail("test@@example.com")).toBe("Invalid email address");
  });

  it("rejects common TLD typos", () => {
    expect(validateEmail("test@example.con")).toBe(
      "Please check your email domain (e.g. .com instead of .con)"
    );
    expect(validateEmail("user@domain.cmo")).toBe(
      "Please check your email domain (e.g. .com instead of .con)"
    );
  });
});

describe("validateDateOfBirth", () => {
  it("accepts valid DOB (18+ years ago)", () => {
    expect(validateDateOfBirth("1990-01-15")).toBe(true);
    expect(validateDateOfBirth("2000-12-31")).toBe(true);
  });

  it("rejects empty", () => {
    expect(validateDateOfBirth("")).toBe("Date of birth is required");
  });

  it("rejects invalid format", () => {
    expect(validateDateOfBirth("01-15-1990")).toBe(
      "Invalid date format (use YYYY-MM-DD)"
    );
    expect(validateDateOfBirth("1990/01/15")).toBe(
      "Invalid date format (use YYYY-MM-DD)"
    );
  });

  it("rejects invalid calendar date", () => {
    expect(validateDateOfBirth("2025-02-30")).toBe("Invalid date");
    expect(validateDateOfBirth("1990-13-01")).toBe("Invalid date");
  });

  it("rejects future date", () => {
    expect(validateDateOfBirth("2030-01-01")).toBe(
      "Date of birth cannot be in the future"
    );
  });

  it("rejects under 18", () => {
    const recentDate = new Date();
    recentDate.setFullYear(recentDate.getFullYear() - 10);
    const dob = recentDate.toISOString().slice(0, 10);
    expect(validateDateOfBirth(dob)).toBe(
      "You must be at least 18 years old to open an account"
    );
  });
});

describe("getMaxDateOfBirth", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = getMaxDateOfBirth();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns date approximately 18 years ago", () => {
    const result = getMaxDateOfBirth();
    const maxDate = new Date(result);
    const today = new Date();
    const expectedYear = today.getFullYear() - 18;
    expect(maxDate.getFullYear()).toBe(expectedYear);
  });
});

describe("validatePassword / isValidPassword", () => {
  it("accepts valid complex password", () => {
    const valid = "SecurePass1!";
    expect(validatePassword(valid)).toBe(true);
    expect(isValidPassword(valid)).toBe(true);
  });

  it("rejects empty", () => {
    expect(validatePassword("")).toBe("Password is required");
    expect(isValidPassword("")).toBe(false);
  });

  it("rejects too short", () => {
    expect(validatePassword("Ab1!")).toBe(
      "Password must be at least 8 characters"
    );
    expect(isValidPassword("Ab1!")).toBe(false);
  });

  it("rejects common passwords", () => {
    expect(validatePassword("password123")).toBe("Password is too common");
    expect(isValidPassword("password123")).toBe(false);
  });

  it("rejects missing uppercase", () => {
    expect(validatePassword("password1!")).toBe(
      "Password must contain at least one uppercase letter"
    );
  });

  it("rejects missing lowercase", () => {
    expect(validatePassword("PASSWORD1!")).toBe(
      "Password must contain at least one lowercase letter"
    );
  });

  it("rejects missing number", () => {
    expect(validatePassword("Password!!")).toBe(
      "Password must contain at least one number"
    );
  });

  it("rejects missing special character", () => {
    expect(validatePassword("MySecurePass1")).toBe(
      "Password must contain at least one special character (!@#$%^&*...)"
    );
  });
});

describe("validateCardNumber / isValidCardNumber", () => {
  it("accepts valid Visa (Luhn pass)", () => {
    expect(validateCardNumber("4111111111111111")).toBe(true);
    expect(isValidCardNumber("4111111111111111")).toBe(true);
  });

  it("accepts valid Mastercard", () => {
    expect(validateCardNumber("5500000000000004")).toBe(true);
  });

  it("accepts valid Amex (15 digits)", () => {
    expect(validateCardNumber("378282246310005")).toBe(true);
  });

  it("accepts card with spaces", () => {
    expect(validateCardNumber("4111 1111 1111 1111")).toBe(true);
  });

  it("rejects invalid Luhn", () => {
    expect(validateCardNumber("4111111111111112")).toBe("Invalid card number");
    expect(isValidCardNumber("4111111111111112")).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(validateCardNumber("411111111111")).toBe(
      "Card number must be 13, 15, 16, or 19 digits"
    );
  });

  it("rejects unsupported prefix", () => {
    const result = validateCardNumber("9123456789012346");
    expect(result).not.toBe(true);
    expect(typeof result).toBe("string");
  });

  it("rejects empty", () => {
    expect(validateCardNumber("")).toBe("Card number is required");
    expect(isValidCardNumber("")).toBe(false);
  });

  it("rejects non-digits (letters)", () => {
    expect(validateCardNumber("4111-1111-1111-111a")).toBe(
      "Card number must contain only digits"
    );
  });
});

describe("validateAmountInput", () => {
  it("accepts valid amounts", () => {
    expect(validateAmountInput("10.00")).toBe(true);
    expect(validateAmountInput("0.50")).toBe(true);
    expect(validateAmountInput("1")).toBe(true);
    expect(validateAmountInput("1.5")).toBe(true);
    expect(validateAmountInput("10000")).toBe(true);
  });

  it("rejects empty", () => {
    expect(validateAmountInput("")).toBe("Amount is required");
    expect(validateAmountInput("   ")).toBe("Amount is required");
  });

  it("rejects leading zeros (VAL-209)", () => {
    expect(validateAmountInput("00010.00")).toBe(
      "Avoid leading zeros (use 10.00 not 010.00)"
    );
    expect(validateAmountInput("001.50")).toBe(
      "Avoid leading zeros (use 10.00 not 010.00)"
    );
    expect(validateAmountInput("01")).toBe(
      "Avoid leading zeros (use 10.00 not 010.00)"
    );
    expect(validateAmountInput("001")).toBe(
      "Avoid leading zeros (use 10.00 not 010.00)"
    );
  });

  it("rejects invalid format", () => {
    expect(validateAmountInput("10.999")).toBe(
      "Invalid amount format (e.g. 10.00)"
    );
    expect(validateAmountInput("abc")).toBe(
      "Invalid amount format (e.g. 10.00)"
    );
  });

  it("rejects below minimum", () => {
    expect(validateAmountInput("0")).toBe("Amount must be at least $0.01");
    expect(validateAmountInput("0.00")).toBe("Amount must be at least $0.01");
  });

  it("rejects above maximum", () => {
    expect(validateAmountInput("10001")).toBe("Amount cannot exceed $10,000");
  });
});
