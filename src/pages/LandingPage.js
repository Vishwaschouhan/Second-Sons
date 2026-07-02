import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <div className="landing-hero">
        <h1>SecondSons</h1>
        <p>
          Your all-in-one super app — cab rides, home services, housing,
          doctor consultations, food delivery, groceries &amp; more.
        </p>
        <div className="cta-buttons">
          <Link to="/register" className="cta-btn primary">
            Get Started
          </Link>
          <Link to="/login" className="cta-btn secondary">
            Sign In
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="landing-features">
        <h2>Everything You Need</h2>
        <div className="features-grid">
          <div className="feature-card">
            <span className="feature-icon">🚕</span>
            <h3>Cab Rides</h3>
            <p>Book affordable rides instantly with real-time driver matching.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🔧</span>
            <h3>Home Services</h3>
            <p>Plumber, electrician, carpenter — skilled workers on demand.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🏠</span>
            <h3>Housing</h3>
            <p>Find daily stays or monthly rentals with verified listings.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🩺</span>
            <h3>Doctor Consults</h3>
            <p>Chat with doctors, get prescriptions — all from your phone.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🍔</span>
            <h3>Food Delivery</h3>
            <p>Order from your favourite restaurants with quick delivery.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🛒</span>
            <h3>Quick Commerce</h3>
            <p>Groceries and essentials delivered to your door in minutes.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">💊</span>
            <h3>Medicines</h3>
            <p>Order verified medicines with doctor-approved prescriptions.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🤖</span>
            <h3>AI Assistant</h3>
            <p>Talk naturally — our AI books cabs, orders food, and more.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
