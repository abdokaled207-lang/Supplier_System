import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, getToken, setToken } from "./client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("token helpers", () => {
  beforeEach(() => localStorage.clear());

  it("setToken stores and getToken reads from localStorage", () => {
    setToken("abc.def.ghi");
    expect(getToken()).toBe("abc.def.ghi");
    expect(localStorage.getItem("token")).toBe("abc.def.ghi");
  });

  it("setToken(null) removes the token", () => {
    setToken("abc");
    setToken(null);
    expect(getToken()).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });
});

describe("api request wrapper", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the parsed body for a success response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 1 }] })));

    const body = await api.get<{ data: { id: number }[] }>("/customers");
    expect(body).toEqual({ data: [{ id: 1 }] });
  });

  it("sends the Authorization header when a token exists", async () => {
    setToken("tok123");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: null }));
    vi.stubGlobal("fetch", fetchMock);

    await api.get("/products");
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Headers).get("Authorization")).toBe("Bearer tok123");
  });

  it("POSTs JSON with Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 7 } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await api.post("/customers", { fullName: "Ahmad", phone: "012" });
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/customers");
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ fullName: "Ahmad", phone: "012" }));
    expect((options.headers as Headers).get("Content-Type")).toContain("application/json");
  });

  it("throws ApiError with code/status for an error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: "NOT_FOUND", message: "Customer not found" } }, 404),
      ),
    );

    const err = await api.get("/customers/999").then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("NOT_FOUND");
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).message).toBe("Customer not found");
  });

  it("throws ApiError for a non-JSON error response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));

    const err = await api.delete("/customers/1").then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
  });

  it("resolves undefined for a 204 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const body = await api.delete("/customers/1");
    expect(body).toBeUndefined();
  });
});