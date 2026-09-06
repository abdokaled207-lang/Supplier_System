import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useState, useEffect, useRef } from "react";
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

function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div className="layout">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <h1>{getCompanyName()}</h1>
        <form className="sidebar-search" onSubmit={handleSearch} role="search">
          <input
            type="search"
            placeholder="Search…"
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
                  <NavLink key={c.customerId} to={`/customers/${c.customerId}`} onClick={() => { setSearchResults(null); setSearchQuery(""); }}>
                    {c.fullName}
                  </NavLink>
                ))}
              </div>
            )}
            {searchResults.products.length > 0 && (
              <div>
                <p className="search-group-label">Products ({searchResults.products.length})</p>
                {searchResults.products.map((p) => (
                  <NavLink key={p.productId} to="/products" onClick={() => { setSearchResults(null); setSearchQuery(""); }}>
                    {p.productName}
                  </NavLink>
                ))}
              </div>
            )}
            {searchResults.orders.length > 0 && (
              <div>
                <p className="search-group-label">Orders ({searchResults.orders.length})</p>
                {searchResults.orders.map((o) => (
                  <NavLink key={o.orderId} to="/orders" onClick={() => { setSearchResults(null); setSearchQuery(""); }}>
                    #{o.orderId} — {o.customerName}
                  </NavLink>
                ))}
              </div>
            )}
            <button className="search-close" onClick={() => { setSearchResults(null); setSearchQuery(""); }} type="button">
              Close
            </button>
          </div>
        )}
        <nav aria-label="Main">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/customers">Customers</NavLink>
          <NavLink to="/products">Products</NavLink>
          <NavLink to="/orders">Orders</NavLink>
          <NavLink to="/stock-receipts">Stock Receipts</NavLink>
          <NavLink to="/reports">Reports</NavLink>
          <NavLink to="/activity">Activity Log</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="user-box">
          <span>{user?.email}</span>
          <span className="role">Role: {user?.role}</span>
          <button className="secondary" onClick={logout}>Logout</button>
        </div>
      </aside>
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
