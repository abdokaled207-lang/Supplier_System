import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider } from "./auth/auth";
import { Layout } from "./App";

vi.mock("./api/client", () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: { customers: [], products: [], orders: [] },
    }),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setToken: vi.fn(),
  getToken: vi.fn(() => "fake-token"),
  ApiError: class ApiError extends Error {},
}));

function renderLayout(initialPath = "/test") {
  localStorage.setItem(
    "user",
    JSON.stringify({ id: 1, email: "admin@roti.local", role: "admin" }),
  );
  localStorage.setItem("roti_company_name", "ROTI CHANI KING");

  const children: ReactNode = <div data-testid="page-content">Page</div>;

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Layout>{children}</Layout>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function getDrawer() {
  return document.getElementById("main-navigation");
}

function isDrawerOpen() {
  const drawer = getDrawer();
  if (!drawer) return false;
  return drawer.getAttribute("data-state") === "open" && !drawer.hasAttribute("hidden");
}

async function openDrawer() {
  const trigger = screen.getByRole("button", { name: /open navigation/i });
  fireEvent.click(trigger);
  await waitFor(() => {
    expect(isDrawerOpen()).toBe(true);
  });
  return getDrawer()!;
}

describe("Navigation Drawer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders hamburger menu button in topbar", () => {
    renderLayout();
    expect(
      screen.getByRole("button", { name: /open navigation/i }),
    ).toBeInTheDocument();
  });

  it("renders brand name in topbar", () => {
    renderLayout();
    const topbar = document.querySelector(".topbar") as HTMLElement;
    expect(within(topbar).getByText("ROTI CHANI KING")).toBeInTheDocument();
  });

  it("drawer is hidden on initial render", () => {
    renderLayout();
    expect(isDrawerOpen()).toBe(false);
  });

  it("opens drawer when hamburger is clicked", async () => {
    renderLayout();
    await openDrawer();
    expect(isDrawerOpen()).toBe(true);
  });

  it("closes drawer when close button is clicked", async () => {
    renderLayout();
    await openDrawer();

    const closeBtn = screen.getByRole("button", {
      name: /close navigation/i,
    });
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(isDrawerOpen()).toBe(false);
    });
  });

  it("renders all nav links with correct grouping", async () => {
    renderLayout();
    const drawer = await openDrawer();
    const { getByText } = within(drawer);

    expect(getByText("Dashboard")).toBeInTheDocument();
    expect(getByText("Sell")).toBeInTheDocument();
    expect(getByText("Orders")).toBeInTheDocument();
    expect(getByText("Manage")).toBeInTheDocument();
    expect(getByText("Customers")).toBeInTheDocument();
    expect(getByText("Products")).toBeInTheDocument();
    expect(getByText("Stock Receipts")).toBeInTheDocument();
    expect(getByText("Insights")).toBeInTheDocument();
    expect(getByText("Reports")).toBeInTheDocument();
    expect(getByText("Activity Log")).toBeInTheDocument();
    expect(getByText("Account")).toBeInTheDocument();
    expect(getByText("Settings")).toBeInTheDocument();
  });

  it("shows user info and logout in drawer footer", async () => {
    renderLayout();
    const drawer = await openDrawer();
    const { getByText, getByRole } = within(drawer);

    expect(getByText("admin@roti.local")).toBeInTheDocument();
    expect(getByText(/role: admin/i)).toBeInTheDocument();
    expect(getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });
});
