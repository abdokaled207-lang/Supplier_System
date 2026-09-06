import { describe, expect, it } from "vitest";
import { canTransition, assertTransition, isTerminal } from "../src/domain/orderStatus";

describe("canTransition", () => {
  it("allows the legal forward path", () => {
    expect(canTransition("PENDING", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "SHIPPED")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(true);
  });

  it("allows cancelling from any non-terminal state", () => {
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
    expect(canTransition("PROCESSING", "CANCELLED")).toBe(true);
    expect(canTransition("SHIPPED", "CANCELLED")).toBe(true);
  });

  it("rejects skipping states and reviving a cancelled order", () => {
    expect(canTransition("PENDING", "DELIVERED")).toBe(false);
    expect(canTransition("PENDING", "SHIPPED")).toBe(false);
    expect(canTransition("CANCELLED", "PENDING")).toBe(false);
    expect(canTransition("CANCELLED", "PROCESSING")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("does not throw for a legal transition or a no-op", () => {
    expect(() => assertTransition("SHIPPED", "DELIVERED")).not.toThrow();
    expect(() => assertTransition("PENDING", "PENDING")).not.toThrow();
  });

  it("throws a 409 conflict for an illegal transition", () => {
    let caught = false;
    try {
      assertTransition("DELIVERED", "SHIPPED");
    } catch (e) {
      caught = true;
      expect((e as { status: number }).status).toBe(409);
      expect((e as { code: string }).code).toBe("CONFLICT");
    }
    expect(caught).toBe(true);
  });
});

describe("isTerminal", () => {
  it("treats delivered and cancelled as terminal", () => {
    expect(isTerminal("DELIVERED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("PENDING")).toBe(false);
    expect(isTerminal("SHIPPED")).toBe(false);
  });
});
