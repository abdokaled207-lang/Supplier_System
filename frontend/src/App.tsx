import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useState, useEffect, useRef } from "react";
import { Drawer } from "@ark-ui/react";
import { Activity as ActivityIcon, BarChart3, Gauge, Menu, Package, ReceiptText, Settings as SettingsIcon, Truck, Users, X } from "lucide-react";
import { useAuth } from "./auth/auth";
import { Login } from "./pages/Login";
import { Customers } from "./pages/Customers";
import { Products } from "./pages/Products";
import { Orders } from "./pages/Orders";
import { EditOrder } from "./pages/EditOrder";
import { StockReceipts } from "./pages/StockReceipts";
import { Reports } from "./pages/Reports";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
import { Invoice } from "./pages/Invoice";
import { CustomerProfile } from "./pages/CustomerProfile";
import { ProductDetail } from "./pages/ProductDetail";
import { Activity } from "./pages/Activity";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { getCompanyName } from "./utils/constants";
import { api } from "./api/client";
import type { SearchResult } from "./api/types";

function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.get<{ data: SearchResult }>(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        setSearchResults(data.data);
      } catch {
        setSearchResults(null);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);
    try {
      const data = await api.get<{ data: SearchResult }>(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(data.data);
    } catch {
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchResults(null);
    setSearchQuery("");
  }

  return (
    <div className="layout">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Drawer.Root
        open={drawerOpen}
        onOpenChange={(details) => setDrawerOpen(details.open)}
        closeOnEscape
        closeOnInteractOutside
        swipeDirection="start"
        restoreFocus
        finalFocusEl={() => hamburgerRef.current}
      >
        <header className="topbar">
          <Drawer.Trigger ref={hamburgerRef} className="topbar-menu-btn" aria-label="Open navigation">
            <Menu size={20} />
          </Drawer.Trigger>
          <Link to="/dashboard" className="topbar-brand">{getCompanyName()}</Link>
          <div className="topbar-search-container">
            <form className="topbar-search" onSubmit={handleSearch} role="search">
              <input
                type="search"
                placeholder="Search customers, products, orders…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search customers, products, orders"
              />
              <button type="submit" disabled={!searchQuery.trim() || searching}>
                {searching ? "…" : "Go"}
              </button>
            </form>
            {searchResults && (
              <div className="search-results-dropdown">
                {searchResults.customers.length === 0 && searchResults.products.length === 0 && searchResults.orders.length === 0 && (
                  <p className="search-no-results">No results for "{searchQuery}"</p>
                )}
                {searchResults.customers.length > 0 && (
                  <div>
                    <p className="search-group-label">Customers ({searchResults.customers.length})</p>
                    {searchResults.customers.map((c) => (
                      <NavLink key={c.customerId} to={`/customers/${c.customerId}`} onClick={clearSearch}>
                        {c.fullName}
                      </NavLink>
                    ))}
                  </div>
                )}
                {searchResults.products.length > 0 && (
                  <div>
                    <p className="search-group-label">Products ({searchResults.products.length})</p>
                    {searchResults.products.map((p) => (
                      <NavLink key={p.productId} to="/products" onClick={clearSearch}>
                        {p.productName}
                      </NavLink>
                    ))}
                  </div>
                )}
                {searchResults.orders.length > 0 && (
                  <div>
                    <p className="search-group-label">Orders ({searchResults.orders.length})</p>
                    {searchResults.orders.map((o) => (
                      <NavLink key={o.orderId} to="/orders" onClick={clearSearch}>
                        #{o.orderId} — {o.customerName}
                      </NavLink>
                    ))}
                  </div>
                )}
                <button className="search-close" onClick={clearSearch} type="button">
                  Close
                </button>
              </div>
            )}
          </div>
        </header>
        <Drawer.Backdrop className="nav-drawer-backdrop" />
        <Drawer.Positioner className="nav-drawer-positioner">
          <Drawer.Content className="nav-drawer-content" id="main-navigation">
            <div className="nav-drawer-header">
              <Drawer.Title className="nav-drawer-title">{getCompanyName()}</Drawer.Title>
              <Drawer.CloseTrigger className="nav-close-btn" aria-label="Close navigation">
                <X size={20} />
              </Drawer.CloseTrigger>
            </div>
            <nav className="nav-links" aria-label="Main">
              <NavLink to="/dashboard" className="nav-link">
                <Gauge size={18} />
                <span>Dashboard</span>
              </NavLink>

              <p className="nav-group-label">Sell</p>
              <NavLink to="/orders" className="nav-link">
                <ReceiptText size={18} />
                <span>Orders</span>
              </NavLink>

              <p className="nav-group-label">Manage</p>
              <NavLink to="/customers" className="nav-link">
                <Users size={18} />
                <span>Customers</span>
              </NavLink>
              <NavLink to="/products" className="nav-link">
                <Package size={18} />
                <span>Products</span>
              </NavLink>
              <NavLink to="/stock-receipts" className="nav-link">
                <Truck size={18} />
                <span>Stock Receipts</span>
              </NavLink>

              <p className="nav-group-label">Insights</p>
              <NavLink to="/reports" className="nav-link">
                <BarChart3 size={18} />
                <span>Reports</span>
              </NavLink>
              <NavLink to="/activity" className="nav-link">
                <ActivityIcon size={18} />
                <span>Activity Log</span>
              </NavLink>

              <p className="nav-group-label">Account</p>
              <NavLink to="/settings" className="nav-link">
                <SettingsIcon size={18} />
                <span>Settings</span>
              </NavLink>
            </nav>
            <div className="nav-footer">
              <div className="nav-user-info">
                <span>{user?.email}</span>
                <span className="nav-user-role">Role: {user?.role}</span>
              </div>
              <button className="secondary nav-logout-btn" onClick={logout}>Logout</button>
            </div>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
      <main className="content" id="main-content">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="*"
        element={
          <Protected>
            <Layout>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerProfile />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/orders/:id/edit" element={<EditOrder />} />
                <Route path="/orders/:id/invoice" element={<Invoice />} />
                <Route path="/stock-receipts" element={<StockReceipts />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          </Protected>
        }
      />
    </Routes>
  );
}
