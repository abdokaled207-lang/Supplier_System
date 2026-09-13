import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Dashboard } from "./Dashboard";

vi.mock("../api/client", () => {
  const dashboardData = {
    totalOrders: 10,
    statusCounts: {
      PENDING: 1,
      PROCESSING: 1,
      SHIPPED: 1,
      DELIVERED: 1,
      CANCELLED: 1,
    },
    openOrders: 4,
    revenue: "500.00",
    outstanding: "120.00",
    todaySales: { total: "100.00", count: 3 },
    lowStock: [
      { productId: 1, productName: "Roti Chani", imageUrl: "", stockQuantity: 2 },
      { productId: 2, productName: "Roti Chpati", imageUrl: "", stockQuantity: 3 },
      { productId: 3, productName: "Roti Pori", imageUrl: "", stockQuantity: 1 },
      { productId: 4, productName: "Salted Duck Egg", imageUrl: "", stockQuantity: 4 },
    ],
  };

  return {
    api: {
      get: vi.fn((path: string) => {
        if (path.includes("best-sellers")) return Promise.resolve({ data: [] });
        return Promise.resolve({ data: dashboardData });
      }),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    setToken: vi.fn(),
    getToken: vi.fn(() => null),
    ApiError: class ApiError extends Error {},
  };
});

const EXPECTED_CARDS = [
  { label: "Today's sales", tint: "green", icon: "lucide-dollar-sign" },
  { label: "Today's orders", tint: "blue", icon: "lucide-shopping-bag" },
  { label: "Total orders", tint: "purple", icon: "lucide-clipboard-list" },
  { label: "Open orders", tint: "amber", icon: "lucide-clock" },
  { label: "Revenue (non-cancelled)", tint: "teal", icon: "lucide-trending-up" },
  { label: "Outstanding balance", tint: "rose", icon: "lucide-circle-dollar-sign" },
];

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Dashboard stat-card icons", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders one colored icon circle per stat card with the right tint and icon", async () => {
    const { container } = renderDashboard();

    await screen.findByText("Today's sales");

    const icons = Array.from(container.querySelectorAll(".stat-card__icon"));
    expect(icons).toHaveLength(6);

    for (const { label, tint, icon } of EXPECTED_CARDS) {
      const iconEl = container.querySelector(`.stat-card__icon--${tint}`)!;
      expect(iconEl).not.toBeNull();
      const card = iconEl.closest(".stat-card") as HTMLElement;
      expect(card).toBeInTheDocument();
      expect(within(card).getByText(label)).toBeInTheDocument();
      expect(iconEl.querySelector("svg")).toHaveClass(icon);
    }
  });

  it("leaves the stat card data unchanged", async () => {
    const { container } = renderDashboard();

    await screen.findByText("100.00");

    const grid = container.querySelector(".dashboard-grid") as HTMLElement;
    expect(within(grid).getByText("100.00")).toBeInTheDocument();
    expect(within(grid).getByText("10")).toBeInTheDocument();
    expect(within(grid).getByText("4")).toBeInTheDocument();
    expect(within(grid).getByText("500.00")).toBeInTheDocument();
    expect(within(grid).getByText("120.00")).toBeInTheDocument();
  });

  it("renders a package icon circle for every low-stock product row", async () => {
    renderDashboard();

    const heading = await screen.findByRole("heading", { name: "Low stock" });
    const lowStockCard = heading.closest(".card") as HTMLElement;

    const productIcons = Array.from(lowStockCard.querySelectorAll(".product-icon"));
    expect(productIcons).toHaveLength(4);

    for (const icon of productIcons) {
      expect(icon.querySelector("svg")).toHaveClass("lucide-package");
    }
  });
});
