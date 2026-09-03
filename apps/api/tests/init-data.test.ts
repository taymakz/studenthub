import { createHmac } from "node:crypto";
import { describe, it, expect, vi } from "vitest";

// Mock config early like auth-rbac.test.ts exemplar
vi.mock("../src/config.ts", () => ({
  config: {
    TELEGRAM_BOT_TOKEN: "test-bot-token-123",
  },
}));

import { validateTelegramInitData } from "../src/lib/auth/init-data.ts";
import { telegramDry } from "../src/lib/telegram/bot.ts";

const TOKEN = "test-bot-token-123";

function signInitData(user: Record<string, unknown>, authDate: number): string {
  const params: Record<string, string> = {
    auth_date: String(authDate),
    query_id: "AAETEST",
    user: JSON.stringify(user),
  };
  const dataCheckString = Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(TOKEN).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

const baseUser = {
  id: 950000099,
  first_name: "Test",
  last_name: "User",
  username: "testuser",
  language_code: "fa",
};

describe("validateTelegramInitData", () => {
  it("accepts correctly signed initData", () => {
    const authDate = Math.floor(Date.now() / 1000);
    const out = validateTelegramInitData(signInitData(baseUser, authDate));
    expect(out?.user.id).toBe(950000099);
    expect(out?.user.firstName).toBe("Test");
  });

  it("rejects tampered user id (forged identity)", () => {
    const authDate = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams(signInitData(baseUser, authDate));
    // Attacker swaps the user payload but cannot re-sign without the token.
    params.set(
      "user",
      JSON.stringify({ ...baseUser, id: 5725800953 })
    );
    expect(validateTelegramInitData(params.toString())).toBeNull();
  });

  it("rejects initData signed with a different token", () => {
    const authDate = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams(signInitData(baseUser, authDate));
    params.set("hash", "0".repeat(64));
    expect(validateTelegramInitData(params.toString())).toBeNull();
  });

  it("rejects stale auth_date (>24h)", () => {
    const old = Math.floor(Date.now() / 1000) - 90_000;
    expect(validateTelegramInitData(signInitData(baseUser, old))).toBeNull();
  });

  it("rejects far-future auth_date (replay-forever guard)", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(validateTelegramInitData(signInitData(baseUser, future))).toBeNull();
  });

  it("rejects missing hash", () => {
    expect(validateTelegramInitData("auth_date=1&user=%7B%7D")).toBeNull();
  });
});

describe("telegramDry gate", () => {
  it("is dry without live conditions (dev default cannot spam real chats)", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(telegramDry()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(telegramDry()).toBe(false);
    vi.unstubAllEnvs();
  });
});
