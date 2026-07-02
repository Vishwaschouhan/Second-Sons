import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';

const CustomerCommerce = ({ mode = 'all' }) => {
  const { user, profile, loading } = useAuth();
  const [shops, setShops] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [buyNowItem, setBuyNowItem] = useState(null);
  const [buyNowQty, setBuyNowQty] = useState(1);

  useEffect(() => {
    // All shops (users with role SHOP)
    const qShops = query(
      collection(db, 'users'),
      where('role', '==', 'SHOP')
    );
    const unsubShops = onSnapshot(qShops, (snapshot) => {
      setShops(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // All restaurants (users with role RESTAURANT)
    const qRestaurants = query(
      collection(db, 'users'),
      where('role', '==', 'RESTAURANT')
    );
    const unsubRestaurants = onSnapshot(qRestaurants, (snapshot) => {
      setRestaurants(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // All pharmacies (users with role PHARMACY)
    const qPharmacies = query(
      collection(db, 'users'),
      where('role', '==', 'PHARMACY')
    );
    const unsubPharmacies = onSnapshot(qPharmacies, (snapshot) => {
      setPharmacies(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // All available products (we filter by shopId in UI)
    const qProducts = query(
      collection(db, 'products'),
      where('isAvailable', '==', true)
    );
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubShops();
      unsubRestaurants();
      unsubPharmacies();
      unsubProducts();
    };
  }, []);

  if (loading || !profile) {
    return <div>Loading...</div>;
  }

  const savedAddress = profile.address || '';

  const shopProducts = selectedShop
    ? products.filter((p) => p.shopId === selectedShop.id)
    : [];

  const selectShop = (shop) => {
    setSelectedShop(shop);
    setMessage('');
    setError('');
    setSpecialRequest('');
  };

  const addToCart = async (product) => {
    setMessage('');
    setError('');

    if (!savedAddress) {
      setError(
        'Please set your address in My Profile before adding items to cart.'
      );
      return;
    }

    // Check for expired medicine
    if (product.type === 'medicine' && product.expiryDate) {
      if (new Date(product.expiryDate) < new Date()) {
        setError('Cannot order expired medicine.');
        return;
      }
    }

    try {
      // We keep one cart item doc per (userId, productId, specialRequest)
      // Note: If specialRequest differs, it should be a new item.
      // Firestore query for exact match including specialRequest might be tricky if field is missing.
      // For simplicity, let's query by userId and productId, then filter in JS or just add new doc always if specialRequest is present.
      // To keep it simple and robust:
      // If specialRequest is present, ALWAYS add a new item (don't merge).
      // If no specialRequest, try to merge with existing item that has NO specialRequest.

      let existingItem = null;

      if (!specialRequest) {
        const q = query(
          collection(db, 'cartItems'),
          where('userId', '==', user.uid),
          where('productId', '==', product.id)
        );
        const snap = await getDocs(q);
        // Find one that has no specialRequest
        existingItem = snap.docs.find(d => !d.data().specialRequest);
      }

      if (!existingItem) {
        // New item
        await addDoc(collection(db, 'cartItems'), {
          userId: user.uid,
          shopId: product.shopId,
          productId: product.id,
          quantity: 1,
          specialRequest: specialRequest || null,
          createdAt: serverTimestamp(),
        });
      } else {
        // Increment existing quantity
        const currentQty = existingItem.data().quantity || 1;
        await updateDoc(existingItem.ref, {
          quantity: currentQty + 1,
        });
      }

      setMessage('Added to cart. You can review and place order from the Cart page.');
      setSpecialRequest('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to add to cart');
    }
  };



  const buyNow = (product) => {
    setMessage('');
    setError('');

    if (!savedAddress) {
      setError('Please set your address in My Profile before placing an order.');
      return;
    }

    if (product.type === 'medicine' && product.expiryDate) {
      if (new Date(product.expiryDate) < new Date()) {
        setError('Cannot order expired medicine.');
        return;
      }
    }

    setBuyNowItem(product);
    setBuyNowQty(1);
  };

  const cancelBuyNow = () => {
    setBuyNowItem(null);
    setBuyNowQty(1);
  };

  const confirmBuyNow = async () => {
    if (!buyNowItem) return;

    const qty = parseInt(buyNowQty, 10);
    if (Number.isNaN(qty) || qty <= 0) {
      alert('Invalid quantity');
      return;
    }

    try {
      await addDoc(collection(db, 'commerceOrders'), {
        customerId: user.uid,
        shopId: buyNowItem.shopId,
        productId: buyNowItem.id,
        quantity: qty,
        specialRequest: specialRequest || null,
        prescriptionUrl: null,
        status: 'pending',
        isRepeatable: false,
        repeatFrequency: null,
        deliveryPartnerId: null,
        address: savedAddress,
        createdAt: serverTimestamp(),
      });
      setMessage('Order placed successfully! Check "My Orders".');
      setSpecialRequest('');
      setBuyNowItem(null);
    } catch (err) {
      console.error(err);
      setError('Failed to place order.');
    }
  };

  const showShops = mode === 'all' || mode === 'shop';
  const showRestaurants = mode === 'all' || mode === 'restaurant';
  const showPharmacies = mode === 'all' || mode === 'medicine';

  let title = 'Quick Commerce & Food Delivery';
  if (mode === 'shop') title = 'Quick Commerce (Shops)';
  if (mode === 'restaurant') title = 'Food Delivery (Restaurants)';
  if (mode === 'medicine') title = 'Order Medicines (Pharmacies)';

  // Helper to find substitutes
  const findSubstitutes = (product) => {
    if (!product.genericName || !product.dose) return [];
    return shopProducts.filter(p =>
      p.id !== product.id &&
      p.genericName === product.genericName &&
      p.dose === product.dose
    );
  };

  return (
    <div>
      <h1>{title}</h1>
      <p>
        Your order history is in the <strong>"My Orders"</strong> page.
        Adding items here will store them in your <strong>Cart</strong>.
      </p>

      <p>
        <strong>Using your saved address:</strong>{' '}
        {savedAddress
          ? savedAddress
          : 'No address set. Go to "My Profile" and set your address.'}
      </p>

      {message && (
        <p style={{ color: 'green', marginTop: '8px' }}>{message}</p>
      )}
      {error && (
        <p style={{ color: 'red', marginTop: '8px' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* Shops list */}
        {showShops && (
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h2>Shops</h2>
            <ul>
              {shops.map((s) => (
                <li key={s.id} style={{ marginBottom: '6px' }}>
                  <div>
                    <strong>{s.name}</strong>
                  </div>
                  {s.address && <div>Address: {s.address}</div>}
                  <button
                    onClick={() => selectShop(s)}
                    style={{ marginTop: '4px' }}
                  >
                    View products
                  </button>
                </li>
              ))}
              {shops.length === 0 && <p>No shops found.</p>}
            </ul>
          </div>
        )}

        {/* Restaurants list */}
        {showRestaurants && (
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h2>Restaurants</h2>
            <ul>
              {restaurants.map((r) => (
                <li key={r.id} style={{ marginBottom: '6px' }}>
                  <div>
                    <strong>{r.name}</strong>
                  </div>
                  {r.address && <div>Address: {r.address}</div>}
                  <button
                    onClick={() => selectShop(r)}
                    style={{ marginTop: '4px' }}
                  >
                    View Menu
                  </button>
                </li>
              ))}
              {restaurants.length === 0 && <p>No restaurants found.</p>}
            </ul>
          </div>
        )}

        {/* Pharmacies list */}
        {showPharmacies && (
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h2>Pharmacies</h2>
            <ul>
              {pharmacies.map((p) => (
                <li key={p.id} style={{ marginBottom: '6px' }}>
                  <div><strong>{p.name}</strong></div>
                  {p.address && <div>Address: {p.address}</div>}
                  <button onClick={() => selectShop(p)} style={{ marginTop: '4px' }}>
                    View Medicines
                  </button>
                </li>
              ))}
              {pharmacies.length === 0 && <p>No pharmacies found.</p>}
            </ul>
          </div>
        )}
      </div>

      {/* Products of selected shop/restaurant/pharmacy */}
      {selectedShop && (
        <div style={{ marginTop: '16px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
          <h2>Items from {selectedShop.name} ({selectedShop.role})</h2>
          <ul>
            {shopProducts.map((p) => {
              const substitutes = selectedShop.role === 'PHARMACY' ? findSubstitutes(p) : [];
              const isExpired = p.expiryDate && new Date(p.expiryDate) < new Date();

              return (
                <li key={p.id} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {p.image && (
                      <img
                        src={p.image}
                        alt={p.name}
                        style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', marginRight: '10px' }}
                      />
                    )}
                    <div>
                      <strong
                        style={{ cursor: 'pointer', color: '#2196F3', textDecoration: 'underline' }}
                        onClick={() => window.location.href = `/product/${p.id}`}
                      >
                        {p.name}
                      </strong>
                      {p.dose && ` ${p.dose}`}
                      {p.brand && ` (${p.brand})`}
                      {p.category && ` (${p.category})`}
                      | ₹{p.price}
                      {p.isVeg !== undefined && (
                        <span style={{ marginLeft: '8px', color: p.isVeg ? 'green' : 'red' }}>
                          {p.isVeg ? '● Veg' : '● Non-Veg'}
                        </span>
                      )}
                      {p.genericName && (
                        <div style={{ fontSize: '0.9em', color: '#666' }}>Generic: {p.genericName}</div>
                      )}
                      {isExpired && (
                        <div style={{ color: 'red', fontWeight: 'bold' }}>EXPIRED - Cannot Order</div>
                      )}
                    </div>
                  </div>
                  {p.stock != null && <div>Stock: {p.stock}</div>}

                  {/* Substitutes */}
                  {substitutes.length > 0 && (
                    <div style={{ margin: '5px 0', fontSize: '0.9em', color: 'blue' }}>
                      <strong>Substitutes available:</strong> {substitutes.map(s => `${s.name} (${s.brand}) - ₹${s.price}`).join(', ')}
                    </div>
                  )}

                  {/* Special Request Input for Food Items */}
                  {selectedShop.role === 'RESTAURANT' && (
                    <div style={{ marginTop: '5px' }}>
                      <input
                        type="text"
                        placeholder="Special request (e.g. no onion)"
                        value={specialRequest}
                        onChange={(e) => setSpecialRequest(e.target.value)}
                        style={{ width: '200px', marginRight: '8px' }}
                      />
                    </div>
                  )}

                  <button
                    onClick={() => addToCart(p)}
                    style={{ marginTop: '4px' }}
                    disabled={!savedAddress || isExpired}
                  >
                    Add to cart
                  </button>
                  {selectedShop.role !== 'PHARMACY' && (
                    <button
                      onClick={() => buyNow(p)}
                      style={{ marginTop: '4px', marginLeft: '8px', backgroundColor: '#ff9800', color: 'white' }}
                      disabled={!savedAddress || isExpired}
                    >
                      Buy Now
                    </button>
                  )}
                </li>
              );
            })}
            {shopProducts.length === 0 && (
              <p>No items available.</p>
            )}
          </ul>
        </div>
      )}
      {/* Buy Now Modal */}
      {buyNowItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '300px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h3>Buy Now: {buyNowItem.name}</h3>
            <p>Price: ₹{buyNowItem.price}</p>
            <label style={{ display: 'block', marginBottom: '10px' }}>
              Quantity:
              <input
                type="number"
                min="1"
                value={buyNowQty}
                onChange={(e) => setBuyNowQty(e.target.value)}
                style={{ width: '100%', marginTop: '5px', padding: '5px' }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={cancelBuyNow} style={{ backgroundColor: '#ccc' }}>Cancel</button>
              <button onClick={confirmBuyNow} style={{ backgroundColor: '#ff9800', color: 'white' }}>Confirm Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerCommerce;
