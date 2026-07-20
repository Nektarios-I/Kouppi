/**
 * CAREER-RATE-001: updateRatingAndTrophies expects a rating *delta*, not absolute rating.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import {
  createUser,
  updateRatingAndTrophies,
  getUserById,
  calculateNewRating,
  getDatabase,
  closeDatabase,
  getRawDb,
} from "@kouppi/database";

const tmpDb = path.join(os.tmpdir(), `kouppi-rating-delta-${process.pid}-${Date.now()}.db`);

describe("CAREER-RATE-001 rating delta vs absolute contract", () => {
  beforeEach(() => {
    process.env.DATABASE_PATH = tmpDb;
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    closeDatabase();
    getDatabase(tmpDb);
  });

  afterEach(() => {
    closeDatabase();
    try {
      if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    } catch {
      // ignore
    }
  });

  it("updateRatingAndTrophies treats second argument as delta (not absolute new rating)", async () => {
    const profile = await createUser("rate_delta_user", "password123");
    const before = getUserById(profile.id)!;
    expect(before.rating).toBe(1200);

    // Simulate Career Elo result for equal opponents / win
    const newRating = calculateNewRating(before.rating, before.rating, 1);
    const ratingDelta = newRating - before.rating;
    expect(ratingDelta).not.toBe(newRating);
    expect(Math.abs(ratingDelta)).toBeLessThan(50);

    const result = updateRatingAndTrophies(profile.id, ratingDelta, 0);
    expect(result.newRating).toBe(newRating);

    const after = getUserById(profile.id)!;
    expect(after.rating).toBe(newRating);
    // Absolute-rating bug would store ~1200 + 1216 ≈ 2416
    expect(after.rating).toBeLessThan(before.rating + 100);
    expect(after.rating).not.toBe(before.rating + newRating);
  });

  it("passing absolute newRating as delta corrupts rating (documents the bug class)", async () => {
    const profile = await createUser("rate_abs_bug", "password123");
    const before = getUserById(profile.id)!;
    const newRating = calculateNewRating(before.rating, before.rating, 1);

    // Wrong call site (pre-fix Career bug): absolute as delta
    updateRatingAndTrophies(profile.id, newRating, 0);
    const corrupted = getUserById(profile.id)!;
    expect(corrupted.rating).toBe(before.rating + newRating);
    expect(corrupted.rating).toBeGreaterThan(2000);
  });

  it("Career call-site pattern (delta = newRating - previousRating) yields expected stored rating", async () => {
    const profile = await createUser("rate_career_pattern", "password123");
    getRawDb().prepare("UPDATE users SET rating = ? WHERE id = ?").run(1400, profile.id);

    const previousRating = 1400;
    const opponentRating = 1400;
    const newRating = calculateNewRating(previousRating, opponentRating, 0); // loss
    const ratingDelta = newRating - previousRating;

    expect(ratingDelta).toBeLessThanOrEqual(0);

    updateRatingAndTrophies(profile.id, ratingDelta, -10);
    const after = getUserById(profile.id)!;
    expect(after.rating).toBe(newRating);
    expect(after.rating).toBeGreaterThanOrEqual(800); // floor
  });
});
