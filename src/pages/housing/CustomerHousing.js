import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';

const CustomerHousing = () => {
  useAuth();
  const [properties, setProperties] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'properties'),
      where('isActive', '==', true)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setProperties(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const filteredProperties = properties.filter((p) => {
    const term = searchTerm.toLowerCase();
    const address = (p.address || '').toLowerCase();
    const title = (p.title || '').toLowerCase();
    return address.includes(term) || title.includes(term);
  });

  return (
    <div>
      <style>{`
        .property-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .property-card {
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          overflow: hidden;
          width: 100%;
          display: flex;
          flex-direction: column;
          background: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .property-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          transform: translateY(-2px);
        }
        .property-card-image {
          width: 100%;
          height: 220px;
          object-fit: cover;
        }
        .property-card-placeholder {
          width: 100%;
          height: 220px;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #999;
          font-size: 0.95rem;
        }
        .property-card-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .property-card-body h3 {
          margin: 0 0 4px 0;
          font-size: 1.15rem;
        }
        .property-card-type {
          color: #888;
          font-size: 0.85em;
          margin: 0 0 6px 0;
        }
        .property-card-address {
          margin: 0 0 10px 0;
          color: #555;
          font-size: 0.9em;
        }
        .property-card-prices {
          margin-top: auto;
        }
        .property-card-price {
          font-weight: 700;
          font-size: 1rem;
          color: #333;
        }
        .property-card-link {
          display: inline-block;
          text-align: center;
          background: linear-gradient(135deg, #f47c20, #e06800);
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          text-decoration: none;
          margin-top: 12px;
          font-weight: 600;
          font-size: 0.9rem;
          transition: opacity 0.2s;
        }
        .property-card-link:hover {
          opacity: 0.9;
          text-decoration: none;
          color: white;
        }
        @media (min-width: 768px) {
          .property-card {
            flex-direction: row;
          }
          .property-card-image,
          .property-card-placeholder {
            width: 40%;
            min-width: 280px;
            height: auto;
            min-height: 220px;
          }
          .property-card-body {
            width: 60%;
          }
        }
      `}</style>

      <h1>Housing (Customer)</h1>
      <p>Your house bookings are available in the "My Orders" page.</p>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search by location or property name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '10px',
            width: '100%',
            maxWidth: '400px',
            borderRadius: '5px',
            border: '1px solid #ccc',
            fontSize: '16px'
          }}
        />
      </div>

      <h2>Available properties</h2>
      <div className="property-grid">
        {filteredProperties.map((p) => (
          <div key={p.id} className="property-card">
            {/* Image */}
            {p.images && p.images.length > 0 ? (
              <img
                src={p.images[0]}
                alt={p.title}
                className="property-card-image"
              />
            ) : p.imageUrl ? (
              <img
                src={p.imageUrl}
                alt={p.title}
                className="property-card-image"
              />
            ) : (
              <div className="property-card-placeholder">
                No Image
              </div>
            )}

            {/* Text Content */}
            <div className="property-card-body">
              <h3>{p.title}</h3>
              <p className="property-card-type">{p.propertyType}</p>
              <p className="property-card-address">{p.address}</p>

              <div className="property-card-prices">
                {p.pricePerDay && (
                  <div className="property-card-price">₹{p.pricePerDay}/day</div>
                )}
                {p.pricePerMonth && (
                  <div className="property-card-price">₹{p.pricePerMonth}/month</div>
                )}

                <a href={`/property/${p.id}`} className="property-card-link">
                  View Details
                </a>
              </div>
            </div>
          </div>
        ))}
        {filteredProperties.length === 0 && (
          <p>No properties found matching your search.</p>
        )}
      </div>
    </div>
  );
};

export default CustomerHousing;
