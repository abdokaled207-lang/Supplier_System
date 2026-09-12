import { describe, expect, it } from "vitest";
import { toWireRole, toDbRole, type WireRole } from "../src/domain/enums";
import { errors, AppError } from "../src/utils/http";

describe("domain/enums role mappers", () => {
  it("toWireRole maps ADMIN -> admin", () => {
    expect(toWireRole("ADMIN")).toBe("admin");
  });

  it("toWireRole maps EMPLOYEE -> employee", () => {
    expect(toWireRole("EMPLOYEE")).toBe("employee");
  });

  it("toWireRole handles lowercase input gracefully (defensive)", () => {
    expect(toWireRole("admin")).toBe("employee"); // 'admin' !== 'ADMIN' -> employee
  });

  it("toDbRole maps wire admin -> ADMIN", () => {
    expect(toDbRole("admin")).toBe("ADMIN");
  });

  it("toDbRole maps wire employee -> EMPLOYEE", () => {
    expect(toDbRole("employee")).toBe("EMPLOYEE");
  });

  it("toDbRole rejects unknown wire role with VALIDATION_ERROR", () => {
    expect(() => toDbRole("superuser" as WireRole)).toThrowError("Unknown role: superuser");
    const err = (() => { try { toDbRole("superuser" as WireRole); } catch (e) { return e; } })();
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("VALIDATION_ERROR");
  });
});