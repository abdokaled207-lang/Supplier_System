import { describe, expect, it } from "vitest";
import { parseDdMmYy } from "./datetime";

describe("parseDdMmYy", () => {
  it("parses DD/MM/YYYY", () => {
    const d = parseDdMmYy("15/03/2026");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getDate()).toBe(15);
    expect(d!.getMonth()).toBe(2); // 0-indexed
    expect(d!.getFullYear()).toBe(2026);
  });

  it("parses single-digit day/month", () => {
    const d = parseDdMmYy("5/3/2026");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getDate()).toBe(5);
    expect(d!.getMonth()).toBe(2);
  });

  it("returns null for invalid format", () => {
    expect(parseDdMmYy("2026-03-15")).toBeNull();
    expect(parseDdMmYy("15-03-2026")).toBeNull();
    expect(parseDdMmYy("")).toBeNull();
  });

  it("JS Date normalizes rolled-over dates (e.g., Feb 31 -> Mar 3)", () => {
    // This is the existing behavior — JS Date constructor auto-corrects invalid dates
    const d = parseDdMmYy("31/02/2026");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getMonth()).toBe(2); // March (0-indexed)
    expect(d!.getDate()).toBe(3);
  });
});