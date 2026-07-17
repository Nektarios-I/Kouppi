/**
 * Trophy Floor Enforcement Tests
 * 
 * Sprint 1 - REQ-1: Trophy Floor Enforcement
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { createUser, updateRatingAndTrophies, getUserById } from "../users.js";
import { getDatabase, closeDatabase } from "../client.js";

const tmpDb = path.join(os.tmpdir(), `kouppi-trophy-floor-${process.pid}.db`);

describe("Trophy Floor Enforcement", () => {
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

  it("should clamp trophies to arena floor on loss (Silver floor at 300)", async () => {
    // Create user with exactly 300 trophies (Silver floor)
    const user = await createUser("testuser1", "password123");
    
    // Manually set trophies to 300 (Silver arena threshold)
    const db = getUserById(user.id);
    expect(db).toBeTruthy();
    
    // Update user to have 300 trophies (exactly at Silver floor)
    updateRatingAndTrophies(user.id, 0, 300);
    
    const beforeUpdate = getUserById(user.id);
    expect(beforeUpdate?.trophies).toBe(300);
    expect(beforeUpdate?.arena).toBe(2); // Silver arena
    
    // Lose 40 trophies (should be clamped to 300)
    const result = updateRatingAndTrophies(user.id, -20, -40);
    
    // Verify trophies stayed at floor
    expect(result.newTrophies).toBe(300);
    expect(result.newArena).toBe(2); // Still in Silver
    
    const afterUpdate = getUserById(user.id);
    expect(afterUpdate?.trophies).toBe(300);
  });

  it("should allow trophy decrease above floor", async () => {
    // Create user with 350 trophies (above Silver floor of 300)
    const user = await createUser("testuser2", "password123");
    
    // Set trophies to 350
    updateRatingAndTrophies(user.id, 0, 350);
    
    const beforeUpdate = getUserById(user.id);
    expect(beforeUpdate?.trophies).toBe(350);
    
    // Lose 40 trophies (should drop to 310, not clamped)
    const result = updateRatingAndTrophies(user.id, -20, -40);
    
    // Verify trophies decreased normally
    expect(result.newTrophies).toBe(310);
    expect(result.newArena).toBe(2); // Still Silver
    
    const afterUpdate = getUserById(user.id);
    expect(afterUpdate?.trophies).toBe(310);
  });

  it("should not affect trophy gains", async () => {
    // Create user at floor (300 trophies)
    const user = await createUser("testuser3", "password123");
    updateRatingAndTrophies(user.id, 0, 300);
    
    const beforeUpdate = getUserById(user.id);
    expect(beforeUpdate?.trophies).toBe(300);
    
    // Win 30 trophies
    const result = updateRatingAndTrophies(user.id, 15, 30);
    
    // Verify trophies increased normally
    expect(result.newTrophies).toBe(330);
    
    const afterUpdate = getUserById(user.id);
    expect(afterUpdate?.trophies).toBe(330);
  });

  it("should handle Bronze floor (0 trophies)", async () => {
    // Create new user (starts at 0 trophies, Bronze arena)
    const user = await createUser("testuser4", "password123");
    
    const beforeUpdate = getUserById(user.id);
    expect(beforeUpdate?.trophies).toBe(0);
    expect(beforeUpdate?.arena).toBe(1); // Bronze
    
    // Lose 20 trophies (should stay at 0)
    const result = updateRatingAndTrophies(user.id, -10, -20);
    
    // Verify trophies stayed at 0
    expect(result.newTrophies).toBe(0);
    expect(result.newArena).toBe(1); // Still Bronze
    
    const afterUpdate = getUserById(user.id);
    expect(afterUpdate?.trophies).toBe(0);
  });

  it("should handle arena promotion correctly", async () => {
    // Create user with 590 trophies (close to Gold threshold of 600)
    const user = await createUser("testuser5", "password123");
    updateRatingAndTrophies(user.id, 0, 590);
    
    const beforeUpdate = getUserById(user.id);
    expect(beforeUpdate?.trophies).toBe(590);
    expect(beforeUpdate?.arena).toBe(2); // Silver (300-599)
    
    // Win 30 trophies (should promote to Gold)
    const result = updateRatingAndTrophies(user.id, 15, 30);
    
    // Verify promotion
    expect(result.newTrophies).toBe(620);
    expect(result.newArena).toBe(3); // Gold
    expect(result.arenaPromotion).toBe(true);
    
    const afterUpdate = getUserById(user.id);
    expect(afterUpdate?.trophies).toBe(620);
    expect(afterUpdate?.arena).toBe(3);
  });

  it("should not drop below new arena floor after promotion", async () => {
    // User promoted to Gold (600+ trophies)
    const user = await createUser("testuser6", "password123");
    updateRatingAndTrophies(user.id, 0, 650);
    
    const beforeUpdate = getUserById(user.id);
    expect(beforeUpdate?.trophies).toBe(650);
    expect(beforeUpdate?.arena).toBe(3); // Gold
    
    // Lose 100 trophies (would drop to 550, but Gold floor is 600)
    const result = updateRatingAndTrophies(user.id, -30, -100);
    
    // Verify clamped to Gold floor
    expect(result.newTrophies).toBe(600);
    expect(result.newArena).toBe(3); // Still Gold
    
    const afterUpdate = getUserById(user.id);
    expect(afterUpdate?.trophies).toBe(600);
  });

  it("should update highest trophies correctly", async () => {
    // Create user and give them 500 trophies
    const user = await createUser("testuser7", "password123");
    updateRatingAndTrophies(user.id, 0, 500);
    
    let userRecord = getUserById(user.id);
    expect(userRecord?.highestTrophies).toBe(500);
    
    // Lose trophies
    updateRatingAndTrophies(user.id, -10, -50);
    userRecord = getUserById(user.id);
    expect(userRecord?.trophies).toBe(450);
    expect(userRecord?.highestTrophies).toBe(500); // Should not decrease
    
    // Win more trophies (new high)
    updateRatingAndTrophies(user.id, 10, 100);
    userRecord = getUserById(user.id);
    expect(userRecord?.trophies).toBe(550);
    expect(userRecord?.highestTrophies).toBe(550); // Should update
  });
});
