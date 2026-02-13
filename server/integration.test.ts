import { describe, it, expect, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createContext } from "./trpc";
import { db } from "@/lib/db";
import { users, sessions, accounts, transactions } from "@/lib/db/schema";

function createMockReq(cookie?: string) {
  return {
    headers: {
      cookie,
      get: (name: string) => (name === "cookie" ? cookie : undefined),
    },
  } as any;
}

function createMockRes() {
  return new Headers();
}

async function createTestContext(cookie?: string) {
  return createContext({
    req: createMockReq(cookie),
    res: createMockRes(),
  } as any);
}

const validSignupInput = {
  email: `test-${Date.now()}@example.com`,
  password: "SecurePass1!",
  firstName: "Test",
  lastName: "User",
  phoneNumber: "+15551234567",
  dateOfBirth: "1990-01-15",
  ssn: "123456789",
  address: "123 Main St",
  city: "Anytown",
  state: "ca",
  zipCode: "12345",
};

describe("auth integration", () => {
  beforeEach(async () => {
    // Clear tables for isolated tests (in-memory DB is fresh per worker, but ensure clean)
    await db.delete(transactions);
    await db.delete(accounts);
    await db.delete(sessions);
    await db.delete(users);
  });

  it("signup creates user and returns token without SSN in response", async () => {
    const ctx = await createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.signup(validSignupInput);

    expect(result.token).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.user).not.toHaveProperty("ssn");
    expect(result.user).not.toHaveProperty("password");
    expect(result.user!.email).toBe(validSignupInput.email.toLowerCase());
  });

  it("signup rejects duplicate email", async () => {
    const ctx = await createTestContext();
    const caller = appRouter.createCaller(ctx);

    await caller.auth.signup(validSignupInput);

    await expect(caller.auth.signup(validSignupInput)).rejects.toThrow(
      expect.objectContaining({
        message: "User already exists",
        code: "CONFLICT",
      })
    );
  });

  it("login returns user without SSN and password", async () => {
    const ctx = await createTestContext();
    const caller = appRouter.createCaller(ctx);

    await caller.auth.signup(validSignupInput);
    const result = await caller.auth.login({
      email: validSignupInput.email,
      password: validSignupInput.password,
    });

    expect(result.user).not.toHaveProperty("ssn");
    expect(result.user).not.toHaveProperty("password");
    expect(result.token).toBeDefined();
  });

  it("login rejects invalid credentials", async () => {
    const ctx = await createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "nonexistent@example.com",
        password: "wrong",
      })
    ).rejects.toThrow(TRPCError);
  });
});

describe("account integration", () => {
  let authToken: string;
  let accountId: number;

  beforeEach(async () => {
    await db.delete(transactions);
    await db.delete(accounts);
    await db.delete(sessions);
    await db.delete(users);

    const ctx = await createTestContext();
    const caller = appRouter.createCaller(ctx);
    const signup = await caller.auth.signup(validSignupInput);
    authToken = signup.token;

    const authCtx = await createTestContext(`session=${authToken}`);
    const authCaller = appRouter.createCaller(authCtx);
    const account = await authCaller.account.createAccount({
      accountType: "checking",
    });
    accountId = account.id;
  });

  it("fundAccount accepts valid card funding", async () => {
    const ctx = await createTestContext(`session=${authToken}`);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.account.fundAccount({
      accountId,
      amount: 100,
      fundingSource: {
        type: "card",
        accountNumber: "4111111111111111",
      },
    });

    expect(result.transaction).toBeDefined();
    expect(result.newBalance).toBeGreaterThan(0);
  });

  it("fundAccount requires routing number for bank transfers", async () => {
    const ctx = await createTestContext(`session=${authToken}`);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.account.fundAccount({
        accountId,
        amount: 100,
        fundingSource: {
          type: "bank",
          accountNumber: "12345678901234",
          // routingNumber omitted - should fail
        },
      })
    ).rejects.toThrow();
  });

  it("fundAccount accepts bank transfer with routing number", async () => {
    const ctx = await createTestContext(`session=${authToken}`);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.account.fundAccount({
      accountId,
      amount: 50,
      fundingSource: {
        type: "bank",
        accountNumber: "12345678901234",
        routingNumber: "123456789",
      },
    });

    expect(result.transaction).toBeDefined();
  });

  it("fundAccount rejects invalid card number", async () => {
    const ctx = await createTestContext(`session=${authToken}`);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.account.fundAccount({
        accountId,
        amount: 100,
        fundingSource: {
          type: "card",
          accountNumber: "4111111111111112", // Invalid Luhn
        },
      })
    ).rejects.toThrow();
  });

  it("getTransactions returns transactions newest first", async () => {
    const ctx = await createTestContext(`session=${authToken}`);
    const caller = appRouter.createCaller(ctx);

    const amounts = Array.from({ length: 15 }, (_, i) => i + 1);
    for (const amount of amounts) {
      await caller.account.fundAccount({
        accountId,
        amount,
        fundingSource: { type: "card", accountNumber: "4111111111111111" },
      });
    }

    const result = await caller.account.getTransactions({ accountId });

    expect(result).toHaveLength(15);
    for (let i = 0; i < 15; i++) {
      expect(result[i].amount).toBe(15 - i);
    }

    const createdAtTimestamps = result.map((t) => new Date(t.createdAt!).getTime());
    expect(createdAtTimestamps).toEqual([...createdAtTimestamps].sort((a, b) => b - a));
  });
});
