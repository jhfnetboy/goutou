// SPDX-License-Identifier: MIT
// Regression test for the labelName filter added in P1.
// Verifies the SQL EXISTS subquery returns only label-matched tasks and that
// matching is case-sensitive (SQLite BINARY collation; no COLLATE NOCASE).

import { beforeAll, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "./helpers/test-db";

const h = vi.hoisted(() => ({ db: undefined as unknown as TestDb }));
vi.mock("@/lib/db", () => ({ getDb: () => h.db }));
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

import type { Viewer } from "@/lib/auth-server";
import {
  projects,
  taskLabels,
  tasks,
  taskStatuses,
  taskTaskLabels,
  user,
} from "@/lib/db/schema";
import { listTasks } from "@/lib/services/reads";

const PROJECT_ID = "proj-coord";
const viewer: Viewer = {
  id: "u-owner",
  email: "owner@test.example",
  name: "Owner",
  role: "member",
  image: null,
};

beforeAll(async () => {
  const { db } = await createTestDb();
  h.db = db;

  await db.insert(user).values({ id: "u-owner", name: "Owner", email: "owner@test.example" });
  await db.insert(projects).values({
    id: PROJECT_ID,
    ownerId: "u-owner",
    name: "Coord",
    slug: "COORD",
    clientName: null,
    summary: null,
    status: "development",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  });
  await db.insert(taskStatuses).values([
    { id: "st-open", projectId: PROJECT_ID, name: "Open", color: "#8a8f98", sortOrder: 0, isInitial: true, isTerminal: false },
  ]);
  await db.insert(tasks).values([
    { id: "t-sdk",   ownerId: "u-owner", projectId: PROJECT_ID, title: "SDK task",   codeNumber: 1, statusId: "st-open", statusName: "Open", statusColor: "#8a8f98", isTerminal: false, priority: "medium", sortOrder: 0, createdAt: new Date("2026-01-02"), updatedAt: new Date("2026-01-02") },
    { id: "t-app",   ownerId: "u-owner", projectId: PROJECT_ID, title: "App task",   codeNumber: 2, statusId: "st-open", statusName: "Open", statusColor: "#8a8f98", isTerminal: false, priority: "medium", sortOrder: 1, createdAt: new Date("2026-01-02"), updatedAt: new Date("2026-01-02") },
    { id: "t-both",  ownerId: "u-owner", projectId: PROJECT_ID, title: "Both task",  codeNumber: 3, statusId: "st-open", statusName: "Open", statusColor: "#8a8f98", isTerminal: false, priority: "medium", sortOrder: 2, createdAt: new Date("2026-01-02"), updatedAt: new Date("2026-01-02") },
    { id: "t-none",  ownerId: "u-owner", projectId: PROJECT_ID, title: "None task",  codeNumber: 4, statusId: "st-open", statusName: "Open", statusColor: "#8a8f98", isTerminal: false, priority: "medium", sortOrder: 3, createdAt: new Date("2026-01-02"), updatedAt: new Date("2026-01-02") },
  ]);
  await db.insert(taskLabels).values([
    { id: "lbl-sdk", projectId: PROJECT_ID, name: "repo:sdk", color: "#27a644", createdAt: new Date("2026-01-01") },
    { id: "lbl-app", projectId: PROJECT_ID, name: "repo:app", color: "#eb5757", createdAt: new Date("2026-01-01") },
  ]);
  await db.insert(taskTaskLabels).values([
    { taskId: "t-sdk",  labelId: "lbl-sdk" },
    { taskId: "t-app",  labelId: "lbl-app" },
    { taskId: "t-both", labelId: "lbl-sdk" },
    { taskId: "t-both", labelId: "lbl-app" },
  ]);
});

describe("listTasks labelName filter", () => {
  it("returns only tasks tagged with the given label", async () => {
    const result = await listTasks(viewer, { projectId: PROJECT_ID, labelName: "repo:sdk" });
    const ids = result.map((t) => t.id).sort();
    expect(ids).toEqual(["t-both", "t-sdk"]);
  });

  it("excludes tasks not tagged with the label", async () => {
    const result = await listTasks(viewer, { projectId: PROJECT_ID, labelName: "repo:app" });
    const ids = result.map((t) => t.id).sort();
    expect(ids).toEqual(["t-app", "t-both"]);
  });

  it("returns all tasks when labelName is omitted", async () => {
    const result = await listTasks(viewer, { projectId: PROJECT_ID });
    expect(result).toHaveLength(4);
  });

  it("returns empty when no tasks have the label", async () => {
    const result = await listTasks(viewer, { projectId: PROJECT_ID, labelName: "repo:nonexistent" });
    expect(result).toHaveLength(0);
  });

  it("is case-sensitive: repo:SDK does not match repo:sdk", async () => {
    // SQLite BINARY collation — exact match only; callers must normalize casing
    const result = await listTasks(viewer, { projectId: PROJECT_ID, labelName: "repo:SDK" });
    expect(result).toHaveLength(0);
  });
});
