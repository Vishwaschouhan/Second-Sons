import React, { useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';

import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Dashboard from './pages/Dashboard';

import CustomerCab from './pages/cab/CustomerCab';
import DriverCab from './pages/cab/DriverCab';

import CustomerServiceRequest from './pages/services/CustomerServiceRequest';
import WorkerDashboard from './pages/services/WorkerDashboard';

import HostProperties from './pages/housing/HostProperties';
import CustomerHousing from './pages/housing/CustomerHousing';
import PropertyDetails from './pages/housing/PropertyDetails';

import MedicalCustomer from './pages/medical/MedicalCustomer';
import DoctorDashboard from './pages/medical/DoctorDashboard';

import CustomerCommerce from './pages/commerce/CustomerCommerce';
import ShopDashboard from './pages/commerce/ShopDashboard';
import RestaurantDashboard from './pages/food/RestaurantDashboard';
import PharmacyDashboard from './pages/pharmacy/PharmacyDashboard';
import DeliveryDashboard from './pages/commerce/DeliveryDashboard';
import CommerceCart from './pages/commerce/CommerceCart';
import ProductDetails from './pages/commerce/ProductDetails';

import UserProfile from './pages/Profile/UserProfile';
import CustomerOrders from './pages/orders/CustomerOrders';
import LandingPage from './pages/LandingPage';
import AiAssistant from './pages/assistant/AiAssistant';

import CustomerSupport from './pages/support/CustomerSupport';
import SupportDashboard from './pages/support/SupportDashboard';
import ProviderSupportPage from './pages/support/ProviderSupportPage';

import './App.css';

const RequireAuth = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{
          width: '40px', height: '40px', border: '3px solid #FFD9B3',
          borderTopColor: '#FF6B00', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 16px'
        }} />
        <p style={{ color: '#757575' }}>Loading...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚫</div>
        <h2>Access Denied</h2>
        <p>This page is only for: {allowedRoles.join(', ')}</p>
        <Link to="/" style={{
          display: 'inline-block', marginTop: '16px', padding: '10px 24px',
          background: 'linear-gradient(135deg, #FF6B00, #FF9F43)',
          color: '#fff', borderRadius: '10px', textDecoration: 'none', fontWeight: 600
        }}>
          Go Home
        </Link>
      </div>
    );
  }

  return children;
};

const HomeRoute = () => {
  const { user } = useAuth();
  return user ? <Dashboard /> : <LandingPage />;
};

const AppInner = () => {
  const { user, profile, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen(!menuOpen);
  const closeMenu = () => setMenuOpen(false);

  const handleLogout = () => {
    closeMenu();
    logout();
  };

  return (
    <div>
      <header className="app-header">
        <nav className="app-nav">
          <Link to="/" className="brand" onClick={closeMenu}>
            🔥 SecondSons
          </Link>

          {/* Hamburger button – mobile only */}
          <button
            className={`hamburger-btn ${menuOpen ? 'active' : ''}`}
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          {/* Nav links */}
          <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
            {!user && (
              <Link to="/login" onClick={closeMenu}>Login</Link>
            )}
            {!user && (
              <Link to="/register" onClick={closeMenu}>Register</Link>
            )}
            {user && (
              <>
                <Link to="/profile" onClick={closeMenu}>My Profile</Link>
                <Link to="/commerce/cart" onClick={closeMenu}>🛒 Cart</Link>
                <Link to="/orders" onClick={closeMenu}>My Orders</Link>
                <Link to="/assistant" onClick={closeMenu}>🤖 AI Assistant</Link>
                {profile?.role === 'CUSTOMER' && (
                  <Link to="/support/customer" onClick={closeMenu}>Support</Link>
                )}
                {profile?.role === 'SUPPORT' && (
                  <Link to="/support/dashboard" onClick={closeMenu}>Support Dashboard</Link>
                )}
                {['SHOP', 'DRIVER', 'WORKER', 'HOST', 'DOCTOR', 'DELIVERY', 'RESTAURANT', 'PHARMACY'].includes(profile?.role) && (
                  <Link to="/support/provider" onClick={closeMenu}>Support</Link>
                )}
                <span className="nav-user-info">
                  {profile
                    ? `${profile.name} (${profile.role})`
                    : 'Loading profile...'}
                </span>
                <button onClick={handleLogout}>Logout</button>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Bottom navigation – mobile only (visible when logged in) */}
      {user && (
        <div className="bottom-nav">
          <Link to="/" onClick={closeMenu}>
            <span className="nav-icon">🏠</span>
            Home
          </Link>
          <Link to="/orders" onClick={closeMenu}>
            <span className="nav-icon">📦</span>
            Orders
          </Link>
          <Link to="/commerce/cart" onClick={closeMenu}>
            <span className="nav-icon">🛒</span>
            Cart
          </Link>
          <Link to="/assistant" onClick={closeMenu}>
            <span className="nav-icon">🤖</span>
            AI
          </Link>
          <Link to="/profile" onClick={closeMenu}>
            <span className="nav-icon">👤</span>
            Profile
          </Link>
        </div>
      )}

      <main className="app-main">
        <Routes>
          {/* Landing or dashboard depending on auth */}
          <Route path="/" element={<HomeRoute />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Profile */}
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <UserProfile />
              </RequireAuth>
            }
          />

          {/* Orders overview for customer */}
          <Route
            path="/orders"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <CustomerOrders />
              </RequireAuth>
            }
          />

          {/* AI Assistant */}
          <Route
            path="/assistant"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <AiAssistant />
              </RequireAuth>
            }
          />

          {/* Cab */}
          <Route
            path="/cab/customer"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <CustomerCab />
              </RequireAuth>
            }
          />
          <Route
            path="/cab/driver"
            element={
              <RequireAuth allowedRoles={['DRIVER']}>
                <DriverCab />
              </RequireAuth>
            }
          />

          {/* Services on rent */}
          <Route
            path="/services/customer"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <CustomerServiceRequest />
              </RequireAuth>
            }
          />
          <Route
            path="/services/worker"
            element={
              <RequireAuth allowedRoles={['WORKER']}>
                <WorkerDashboard />
              </RequireAuth>
            }
          />

          {/* Housing */}
          <Route
            path="/housing/host"
            element={
              <RequireAuth allowedRoles={['HOST']}>
                <HostProperties />
              </RequireAuth>
            }
          />
          <Route
            path="/housing/customer"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <CustomerHousing />
              </RequireAuth>
            }
          />
          <Route
            path="/property/:propertyId"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <PropertyDetails />
              </RequireAuth>
            }
          />

          {/* Medical */}
          <Route
            path="/medical/customer"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <MedicalCustomer />
              </RequireAuth>
            }
          />
          <Route
            path="/medical/doctor"
            element={
              <RequireAuth allowedRoles={['DOCTOR']}>
                <DoctorDashboard />
              </RequireAuth>
            }
          />

          {/* Quick commerce */}
          <Route
            path="/commerce/quick"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <CustomerCommerce mode="shop" />
              </RequireAuth>
            }
          />
          <Route
            path="/commerce/food"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <CustomerCommerce mode="restaurant" />
              </RequireAuth>
            }
          />
          <Route
            path="/commerce/medicine"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <CustomerCommerce mode="medicine" />
              </RequireAuth>
            }
          />
          <Route
            path="/product/:productId"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <ProductDetails />
              </RequireAuth>
            }
          />
          {/* Legacy route, defaults to all */}
          <Route
            path="/commerce/customer"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <CustomerCommerce mode="all" />
              </RequireAuth>
            }
          />
          <Route
            path="/commerce/cart"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <CommerceCart />
              </RequireAuth>
            }
          />
          <Route
            path="/commerce/shop"
            element={
              <RequireAuth allowedRoles={['SHOP']}>
                <ShopDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/commerce/delivery"
            element={
              <RequireAuth allowedRoles={['DELIVERY']}>
                <DeliveryDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/commerce/restaurant"
            element={
              <RequireAuth allowedRoles={['RESTAURANT']}>
                <RestaurantDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/commerce/pharmacy"
            element={
              <RequireAuth allowedRoles={['PHARMACY']}>
                <PharmacyDashboard />
              </RequireAuth>
            }
          />

          {/* Customer Support */}
          <Route
            path="/support/customer"
            element={
              <RequireAuth allowedRoles={['CUSTOMER']}>
                <CustomerSupport />
              </RequireAuth>
            }
          />
          <Route
            path="/support/dashboard"
            element={
              <RequireAuth allowedRoles={['SUPPORT']}>
                <SupportDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/support/provider"
            element={
              <RequireAuth allowedRoles={['SHOP', 'DRIVER', 'WORKER', 'HOST', 'DOCTOR', 'DELIVERY', 'RESTAURANT', 'PHARMACY']}>
                <ProviderSupportPage />
              </RequireAuth>
            }
          />

          {/* Fallback */}
          <Route path="*" element={
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔍</div>
              <h1>Page Not Found</h1>
              <p>The page you're looking for doesn't exist.</p>
              <Link to="/" style={{
                display: 'inline-block', marginTop: '16px', padding: '10px 24px',
                background: 'linear-gradient(135deg, #FF6B00, #FF9F43)',
                color: '#fff', borderRadius: '10px', textDecoration: 'none', fontWeight: 600
              }}>
                Go Home
              </Link>
            </div>
          } />
        </Routes>
      </main>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </Router>
  );
};

export default App;
