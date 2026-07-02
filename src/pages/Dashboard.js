import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const Dashboard = () => {
  const { profile, loading } = useAuth();

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

  if (!profile) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>😕</div>
        <h2>No Profile Found</h2>
        <p>Try logging out and logging in again, or registering a new account.</p>
      </div>
    );
  }

  const { name, role } = profile;

  const customerActions = [
    { to: '/cab/customer', icon: '🚕', label: 'Book a Cab' },
    { to: '/services/customer', icon: '🔧', label: 'Home Services' },
    { to: '/housing/customer', icon: '🏠', label: 'Housing' },
    { to: '/medical/customer', icon: '🩺', label: 'Consult Doctor' },
    { to: '/commerce/quick', icon: '🛒', label: 'Quick Commerce' },
    { to: '/commerce/food', icon: '🍔', label: 'Food Delivery' },
    { to: '/commerce/medicine', icon: '💊', label: 'Medicines' },
    { to: '/orders', icon: '📦', label: 'My Orders' },
  ];

  const roleActions = {
    DRIVER: [{ to: '/cab/driver', icon: '🚗', label: 'Cab Requests' }],
    HOST: [{ to: '/housing/host', icon: '🏘️', label: 'Manage Properties' }],
    DOCTOR: [{ to: '/medical/doctor', icon: '📋', label: 'Consultations' }],
    SHOP: [{ to: '/commerce/shop', icon: '🏪', label: 'Manage Products' }],
    DELIVERY: [{ to: '/commerce/delivery', icon: '📦', label: 'Delivery Jobs' }],
    WORKER: [{ to: '/services/worker', icon: '🛠️', label: 'Service Jobs' }],
    RESTAURANT: [{ to: '/commerce/restaurant', icon: '🍽️', label: 'Menu & Orders' }],
    PHARMACY: [{ to: '/commerce/pharmacy', icon: '🏥', label: 'Inventory & Orders' }],
    SUPPORT: [{ to: '/support/dashboard', icon: '🎧', label: 'Support Dashboard' }],
  };

  const actions = role === 'CUSTOMER' ? customerActions : (roleActions[role] || []);

  return (
    <div>
      {/* Welcome Card */}
      <div className="dashboard-welcome">
        <h1>Hello, {name}! 👋</h1>
        <p>{role === 'CUSTOMER' ? 'What would you like to do today?' : `You're signed in as ${role}`}</p>
      </div>

      {/* Action Grid */}
      <h2>{role === 'CUSTOMER' ? 'Quick Actions' : `${role.charAt(0) + role.slice(1).toLowerCase()} Actions`}</h2>
      <div className="action-grid">
        {actions.map((action) => (
          <Link key={action.to} to={action.to} className="action-card">
            <span className="action-icon">{action.icon}</span>
            <span className="action-label">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
