import { describe, expect, it } from "vitest";
import { parseEnv } from "./src/env";

describe("parseEnv", () => {
  it("accepts valid environment values", () => {
    const env = parseEnv({
      NODE_ENV: "test",
      API_PORT: "4000",
      LOG_LEVEL: "debug",
      POSTGRES_PORT: "15432",
      LLM_PROVIDER: "fake",
      EMBEDDING_PROVIDER: "fake",
    });

    expect(env.NODE_ENV).toBe("test");
    expect(env.API_PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe("debug");
    expect(env.POSTGRES_PORT).toBe(15432);
  });

  it("rejects invalid environment values", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "invalid",
        API_PORT: "not-a-port",
      }),
    ).toThrow("Invalid environment configuration");
  });

  it("requires secrets and database URL in production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
      }),
    ).toThrow("Invalid environment configuration");
  });
});
