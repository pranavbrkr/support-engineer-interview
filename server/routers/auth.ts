import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../trpc";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { isValidPassword } from "@/lib/validation";
import { eq } from "drizzle-orm";

const COMMON_TLD_TYPOS = [".con", ".cmo", ".ocm", ".comm", ".coom", ".comn"];

const emailSchema = z
  .string()
  .email("Invalid email address")
  .transform((val) => val.toLowerCase().trim())
  .refine(
    (email) => {
      const domain = email.split("@")[1] || "";
      return !COMMON_TLD_TYPOS.some((typo) => domain.endsWith(typo));
    },
    { message: "Please check your email domain (e.g. .com instead of .con)" }
  );

const MINIMUM_AGE = 18;

const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (use YYYY-MM-DD)")
  .refine(
    (val) => {
      const [y, m, d] = val.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
    },
    { message: "Invalid date" }
  )
  .refine(
    (val) => {
      const birthDate = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      birthDate.setHours(0, 0, 0, 0);
      return birthDate <= today;
    },
    { message: "Date of birth cannot be in the future" }
  )
  .refine(
    (val) => {
      const birthDate = new Date(val);
      const today = new Date();
      const minBirthDate = new Date(today);
      minBirthDate.setFullYear(minBirthDate.getFullYear() - MINIMUM_AGE);
      return birthDate <= minBirthDate;
    },
    { message: `You must be at least ${MINIMUM_AGE} years old to open an account` }
  );

const passwordSchema = z.string().refine(isValidPassword, {
  message: "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
});

export const authRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: passwordSchema,
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phoneNumber: z.string().regex(/^\+?\d{10,15}$/),
        dateOfBirth: dateOfBirthSchema,
        ssn: z.string().regex(/^\d{9}$/),
        address: z.string().min(1),
        city: z.string().min(1),
        state: z.string().length(2).toUpperCase(),
        zipCode: z.string().regex(/^\d{5}$/),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingUser = await db.select().from(users).where(eq(users.email, input.email)).get();

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);
      const hashedSsn = await bcrypt.hash(input.ssn, 10);

      await db.insert(users).values({
        ...input,
        password: hashedPassword,
        ssn: hashedSsn,
      });

      // Fetch the created user
      const user = await db.select().from(users).where(eq(users.email, input.email)).get();

      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }

      // Single session per user: remove any existing sessions before creating the new one
      await db.delete(sessions).where(eq(sessions.userId, user.id));

      // Create session
      const token = jwt.sign(
        { userId: user.id, jti: crypto.randomUUID() },
        process.env.JWT_SECRET || "temporary-secret-for-interview",
        { expiresIn: "7d" }
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt: expiresAt.toISOString(),
      });

      // Set cookie
      if ("setHeader" in ctx.res) {
        ctx.res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      } else {
        (ctx.res as Headers).set("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      }

      const { password: _p, ssn: _s, ...safeUser } = user;
      return { user: safeUser, token };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await db.select().from(users).where(eq(users.email, input.email)).get();

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      const validPassword = await bcrypt.compare(input.password, user.password);

      if (!validPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      // Single session per user: remove any existing sessions before creating the new one
      await db.delete(sessions).where(eq(sessions.userId, user.id));

      const token = jwt.sign(
        { userId: user.id, jti: crypto.randomUUID() },
        process.env.JWT_SECRET || "temporary-secret-for-interview",
        { expiresIn: "7d" }
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt: expiresAt.toISOString(),
      });

      if ("setHeader" in ctx.res) {
        ctx.res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      } else {
        (ctx.res as Headers).set("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      }

      const { password: _p, ssn: _s, ...safeUser } = user;
      return { user: safeUser, token };
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.user) {
      // Delete session from database
      let token: string | undefined;
      if ("cookies" in ctx.req) {
        token = (ctx.req as any).cookies.session;
      } else {
        const cookieHeader = ctx.req.headers.get?.("cookie") || (ctx.req.headers as any).cookie;
        token = cookieHeader
          ?.split("; ")
          .find((c: string) => c.startsWith("session="))
          ?.split("=")[1];
      }
      if (token) {
        await db.delete(sessions).where(eq(sessions.token, token));
      }
    }

    if ("setHeader" in ctx.res) {
      ctx.res.setHeader("Set-Cookie", `session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    } else {
      (ctx.res as Headers).set("Set-Cookie", `session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    }

    return { success: true, message: ctx.user ? "Logged out successfully" : "No active session" };
  }),
});
