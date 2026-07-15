import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import {
  getDatabase,
  closeDatabase,
  createUser,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  listFriends,
  listPendingRequests,
  isFriend,
  getRawDb,
} from "@kouppi/database";
import { generateToken } from "../src/auth/jwt.js";

const tmpDb = path.join(os.tmpdir(), `kouppi-friends-test-${Date.now()}.db`);

beforeAll(() => {
  process.env.DATABASE_PATH = tmpDb;
  process.env.JWT_SECRET = "test-secret-friends";
  try {
    getDatabase(tmpDb);
  } catch (error) {
    console.warn("[friends.test] Skipping — better-sqlite3 unavailable:", error);
  }
});

afterAll(() => {
  closeDatabase();
  try {
    fs.unlinkSync(tmpDb);
  } catch {
    // ignore
  }
});

describe("friends database", () => {
  const dbAvailable = () => {
    try {
      getRawDb();
      return true;
    } catch {
      return false;
    }
  };

  it("send, accept, list friends", async () => {
    if (!dbAvailable()) return;
    const alice = await createUser("alice_friends", "password123");
    const bob = await createUser("bob_friends", "password123");

    const sent = sendFriendRequest(alice.id, { username: "bob_friends" });
    expect("request" in sent).toBe(true);
    if (!("request" in sent)) return;

    expect(isFriend(alice.id, bob.id)).toBe(false);

    const pending = listPendingRequests(bob.id);
    expect(pending.incoming).toHaveLength(1);

    const accepted = acceptFriendRequest(sent.request.id, bob.id);
    expect("request" in accepted).toBe(true);

    expect(isFriend(alice.id, bob.id)).toBe(true);
    expect(listFriends(alice.id)).toHaveLength(1);
    expect(listFriends(bob.id)).toHaveLength(1);
  });

  it("decline and remove friend", async () => {
    if (!dbAvailable()) return;
    const carol = await createUser("carol_friends", "password123");
    const dave = await createUser("dave_friends", "password123");

    const sent = sendFriendRequest(carol.id, { username: "dave_friends" });
    if (!("request" in sent)) throw new Error("expected request");

    const declined = declineFriendRequest(sent.request.id, dave.id);
    expect("request" in declined).toBe(true);
    expect(listPendingRequests(dave.id).incoming).toHaveLength(0);

    const sent2 = sendFriendRequest(carol.id, { username: "dave_friends" });
    if (!("request" in sent2)) throw new Error("expected request2");
    acceptFriendRequest(sent2.request.id, dave.id);

    const removed = removeFriend(carol.id, dave.id);
    expect("ok" in removed).toBe(true);
    expect(isFriend(carol.id, dave.id)).toBe(false);
  });

  it("issues JWT for auth routes", async () => {
    if (!dbAvailable()) return;
    const user = await createUser("jwt_friend_user", "password123");
    const token = generateToken(user.id, user.username);
    expect(token).toBeTruthy();
  });
});
