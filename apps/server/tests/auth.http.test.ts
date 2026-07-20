/**
 * AUTH-NET-001: HTTP auth routes against isolated test DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import type { AddressInfo } from "net";
import { getDatabase, closeDatabase } from "@kouppi/database";
import { createKouppiServer } from "../src/serverFactory.js";

const tmpDb = path.join(os.tmpdir(), `kouppi-auth-http-${process.pid}-${Date.now()}.db`);

describe("AUTH-NET-001 auth HTTP integration", () => {
  let baseUrl = "";
  let stopCleanup: () => void;
  let httpServer: ReturnType<typeof createKouppiServer>["httpServer"];

  beforeAll(async () => {
    process.env.DATABASE_PATH = tmpDb;
    process.env.JWT_SECRET = "auth-http-integration-secret";
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    closeDatabase();
    getDatabase(tmpDb);

    const server = createKouppiServer({ corsOrigin: "*", websocketOnly: true });
    httpServer = server.httpServer;
    stopCleanup = server.stopCleanup;
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    stopCleanup?.();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    closeDatabase();
    try {
      fs.unlinkSync(tmpDb);
    } catch {
      // ignore
    }
  });

  it("POST /api/auth/register creates account (201)", async () => {
    const username = `reg_${Date.now()}`;
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "password123" }),
    });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.token).toBeTruthy();
    expect(data.user.username).toBe(username);
    expect(data.user).not.toHaveProperty("password");
    expect(data.user).not.toHaveProperty("passwordHash");
  });

  it("duplicate registration returns 409 with clear message", async () => {
    const username = `dup_${Date.now()}`;
    await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "password123" }),
    });
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "password123" }),
    });
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/already taken/i);
    expect(data.code).toBe("username_taken");
  });

  it("invalid registration returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "ab", password: "12" }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.code).toBe("validation_error");
  });

  it("login succeeds with valid credentials and fails with invalid", async () => {
    const username = `login_${Date.now()}`;
    await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "password123" }),
    });

    const ok = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "password123" }),
    });
    const okData = await ok.json();
    expect(ok.status).toBe(200);
    expect(okData.success).toBe(true);
    expect(okData.token).toBeTruthy();

    const bad = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "wrong-password" }),
    });
    const badData = await bad.json();
    expect(bad.status).toBe(401);
    expect(badData.success).toBe(false);
    expect(badData.code).toBe("invalid_credentials");
  });

  it("logout revokes session so /me fails with same JWT (JWT-SESS-001)", async () => {
    const username = `logout_${Date.now()}`;
    const reg = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "password123" }),
    });
    const { token } = await reg.json();

    const meOk = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meOk.status).toBe(200);

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logout.status).toBe(200);

    const meAfter = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meAfter.status).toBe(401);
  });
});
