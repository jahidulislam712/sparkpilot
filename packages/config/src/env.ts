import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.url().optional());

const optionalPort = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().int().min(1).max(65535).optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_HOST: z.string().default("127.0.0.1"),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    DATABASE_URL: optionalUrl,
    DIRECT_DATABASE_URL: optionalUrl,
    POSTGRES_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
    CORS_ORIGINS: z.string().default("http://localhost:3000"),
    JWT_SECRET: z.string().min(32).optional(),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
    EMAIL_MODE: z.enum(["smtp", "console"]).default("console"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: optionalPort,
    SMTP_SECURE: z.enum(["true", "false"]).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    MAILPIT_SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
    MAILPIT_HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(8025),
    LLM_PROVIDER: z
      .enum(["nvidia", "openrouter", "groq", "ollama", "gemini", "fake"])
      .default("fake"),
    LLM_AGENT_MODEL: z.string().optional(),
    LLM_CHAT_MODEL: z.string().optional(),
    LLM_BATCH_MODEL: z.string().optional(),
    EMBEDDING_PROVIDER: z.enum(["gemini", "ollama", "fake"]).default("fake"),
    NVIDIA_API_KEY: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    OLLAMA_BASE_URL: optionalUrl,
    WORKER_MODE: z.enum(["inline", "separate"]).default("inline"),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_ID: z.string().optional(),
    SENTRY_DSN: optionalUrl,
    NEXT_PUBLIC_API_URL: optionalUrl,
    NEXT_PUBLIC_WIDGET_URL: optionalUrl,
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production") {
      if (!value.DATABASE_URL) {
        context.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message: "Required in production",
        });
      }
      if (!value.JWT_SECRET) {
        context.addIssue({
          code: "custom",
          path: ["JWT_SECRET"],
          message: "Required in production",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}

export const env = parseEnv(process.env);
