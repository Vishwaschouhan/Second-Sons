import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  addDoc,
  doc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { uploadToCloudinary } from '../../utils/cloudinaryUtils';

const CommerceCart = () => {
  const { user, profile, loading } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [prescription, setPrescription] = useState('');
  const [consultations, setConsultations] = useState([]);
  const [selectedConsultationId, setSelectedConsultationId] = useState('');
  const [isRepeatable, setIsRepeatable] = useState(false);
  const [subscriptionFrequency, setSubscriptionFrequency] = useState('monthly');
  const [customFrequencyDays, setCustomFrequencyDays] = useState(7);

  const calculateDiscount = () => {
    if (!isRepeatable) return 0;
    if (subscriptionFrequency === 'daily') return 2;
    if (subscriptionFrequency === 'monthly') return 3;
    if (subscriptionFrequency === 'yearly') return 5;
    if (subscriptionFrequency === 'custom') {
      const days = parseInt(customFrequencyDays, 10) || 0;
      if (days < 30) return 2;
      if (days < 365) return 3;
      return 5;
    }
    return 0;
  };

  useEffect(() => {
    if (!user) return;

    // Cart items for this user
    const qCart = query(
      collection(db, 'cartItems'),
      where('userId', '==', user.uid)
    );
    const unsubCart = onSnapshot(qCart, (snapshot) => {
      setCartItems(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // All products (used to show names/prices)
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );

    // Medical Consultations (for prescriptions)
    const qConsultations = query(
      collection(db, 'medicalConsultations'),
      where('customerId', '==', user.uid)
    );
    const unsubConsultations = onSnapshot(qConsultations, (snapshot) => {
      setConsultations(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubCart();
      unsubProducts();
      unsubConsultations();
    };
  }, [user]);

  useEffect(() => {
    const loadShops = async () => {
      const shopIds = Array.from(
        new Set(cartItems.map((c) => c.shopId).filter(Boolean))
      );
      const map = {};
      for (const id of shopIds) {
        try {
          const snap = await getDoc(doc(db, 'users', id));
          if (snap.exists()) {
            map[id] = snap.data();
          }
        } catch (err) {
          console.error('Failed to fetch shop profile', err);
        }
      }
      setShops(map);
    };

    if (cartItems.length > 0) {
      loadShops();
    } else {
      setShops({});
    }
  }, [cartItems]);

  if (loading || !profile) {
    return <div>Loading...</div>;
  }

  const savedAddress = profile.address || '';

  const updateQuantity = async (item, newValue) => {
    const qty = parseInt(newValue, 10);
    if (Number.isNaN(qty) || qty <= 0) {
      // treat <=0 as remove
      await deleteDoc(doc(db, 'cartItems', item.id));
      return;
    }
    await updateDoc(doc(db, 'cartItems', item.id), {
      quantity: qty,
    });
  };

  const removeItem = async (item) => {
    await deleteDoc(doc(db, 'cartItems', item.id));
  };

  // Check if any item in cart is a medicine (from a PHARMACY)
  const hasMedicine = cartItems.some(item => {
    const shop = shops[item.shopId];
    return shop?.role === 'PHARMACY';
  });

  const placeOrder = async () => {
    setError('');
    setMessage('');

    if (cartItems.length === 0) {
      setError('Your cart is empty.');
      return;
    }

    if (!savedAddress) {
      setError('Please set your address in My Profile before placing an order.');
      return;
    }

    let finalPrescription = prescription;
    if (selectedConsultationId) {
      const consult = consultations.find(c => c.id === selectedConsultationId);
      if (consult) {
        finalPrescription = `Consultation ID: ${consult.id} | Prescription: ${consult.prescription}`;
      }
    }

    if (hasMedicine && !finalPrescription) {
      setError('Prescription is required for medicine orders. Please select one or upload.');
      return;
    }

    try {
      // One commerceOrders document per cart item
      for (const item of cartItems) {
        const shop = shops[item.shopId];
        const isMedicine = shop?.role === 'PHARMACY';

        await addDoc(collection(db, 'commerceOrders'), {
          customerId: user.uid,
          shopId: item.shopId,
          productId: item.productId,
          quantity: item.quantity,
          specialRequest: item.specialRequest || null,
          prescriptionUrl: isMedicine ? finalPrescription : null,
          status: isMedicine ? 'pending_prescription_review' : 'pending',
          isRepeatable: isRepeatable,
          repeatFrequency: isRepeatable ? subscriptionFrequency : null,
          customFrequencyDays: isRepeatable && subscriptionFrequency === 'custom' ? parseInt(customFrequencyDays, 10) : null,
          subscriptionDiscount: isRepeatable ? calculateDiscount() : 0,
          subscriptionStatus: isRepeatable ? 'active' : null,
          deliveryPartnerId: null,
          address: savedAddress,
          createdAt: serverTimestamp(),
        });

        // Clear cart item
        await deleteDoc(doc(db, 'cartItems', item.id));
      }

      setMessage('Order placed successfully. You can track it in "My Orders".');
      setPrescription('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to place order');
    }
  };

  const getItemTotal = (item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product || typeof product.price !== 'number') return 0;
    return product.price * (item.quantity || 1);
  };

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + getItemTotal(item),
    0
  );

  return (
    <div>
      <h1>Quick Commerce Cart</h1>
      <p>
        Orders placed here will appear in your <strong>"My Orders"</strong> page.
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

      <h2>Items in your cart</h2>
      {cartItems.length === 0 && <p>Cart is empty.</p>}
      {cartItems.length > 0 && (
        <ul>
          {cartItems.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            const shop = shops[item.shopId];
            const lineTotal = getItemTotal(item);

            return (
              <li
                key={item.id}
                style={{
                  marginBottom: '8px',
                  padding: '6px',
                  border: '1px solid #ccc',
                }}
              >
                <div>
                  <strong>
                    {product ? product.name : item.productId}
                  </strong>{' '}
                  {product?.price != null &&
                    `| ₹${product.price} each`}
                  {item.specialRequest && (
                    <div style={{ color: 'red', fontSize: '0.9em' }}>
                      Note: {item.specialRequest}
                    </div>
                  )}
                </div>
                <div>
                  Shop/Restaurant/Pharmacy:{' '}
                  {shop ? shop.name : item.shopId}
                  {shop?.address && ` | Address: ${shop.address}`}
                  {shop?.phone && ` | Phone: ${shop.phone}`}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  Quantity:
                  <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden' }}>
                    <button
                      onClick={() => updateQuantity(item, (item.quantity || 1) - 1)}
                      disabled={(item.quantity || 1) <= 1}
                      style={{
                        width: '32px',
                        height: '32px',
                        border: 'none',
                        background: (item.quantity || 1) <= 1 ? '#eee' : '#f47c20',
                        color: (item.quantity || 1) <= 1 ? '#aaa' : '#fff',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        cursor: (item.quantity || 1) <= 1 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      −
                    </button>
                    <span
                      style={{
                        width: '40px',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        userSelect: 'none',
                      }}
                    >
                      {item.quantity || 1}
                    </span>
                    <button
                      onClick={() => updateQuantity(item, (item.quantity || 1) + 1)}
                      style={{
                        width: '32px',
                        height: '32px',
                        border: 'none',
                        background: '#f47c20',
                        color: '#fff',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item)}
                    style={{ marginLeft: '4px' }}
                  >
                    Remove
                  </button>
                </div>
                <div>
                  Line total: ₹{lineTotal.toFixed(2)}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {cartItems.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <p>
            <strong>Cart total:</strong> ₹{cartTotal.toFixed(2)}
            {isRepeatable && (
              <span style={{ color: 'green', marginLeft: '10px' }}>
                (Discounted Total: ₹{(cartTotal * (1 - calculateDiscount() / 100)).toFixed(2)})
              </span>
            )}
          </p>

          {hasMedicine && (
            <div style={{ marginBottom: '10px', padding: '10px', border: '1px solid orange', backgroundColor: '#fff3e0' }}>
              <h3>Prescription Required</h3>
              <p>One or more items in your cart require a prescription.</p>

              <div style={{ marginBottom: '10px' }}>
                <label>
                  <strong>Option 1: Select from your Doctor Consultations</strong>
                  <br />
                  <select
                    value={selectedConsultationId}
                    onChange={(e) => {
                      setSelectedConsultationId(e.target.value);
                      if (e.target.value) setPrescription(''); // Clear manual input if selecting
                    }}
                    style={{ marginTop: '5px', width: '100%' }}
                  >
                    <option value="">-- Select a consultation --</option>
                    {consultations
                      .filter(c => c.prescription)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.prescription.substring(0, 30)}... (Doctor: {c.doctorId ? 'Yes' : 'Unknown'})
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label>
                  <strong>Option 2: Upload Prescription (PDF/Image)</strong>
                  <br />
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={async (e) => {
                      if (e.target.files[0]) {
                        try {
                          setMessage('Uploading prescription...');
                          const url = await uploadToCloudinary(e.target.files[0]);
                          setPrescription(url);
                          setSelectedConsultationId('');
                          setMessage('Prescription uploaded successfully!');
                        } catch (err) {
                          console.error(err);
                          setError('Failed to upload prescription.');
                        }
                      }
                    }}
                    style={{ marginTop: '5px' }}
                  />
                  {prescription && !selectedConsultationId && (
                    <div style={{ fontSize: '0.8em', color: 'green' }}>
                      Uploaded: <a href={prescription} target="_blank" rel="noopener noreferrer">View File</a>
                    </div>
                  )}
                </label>
              </div>

            </div>
          )}

          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <input
                type="checkbox"
                checked={isRepeatable}
                onChange={(e) => setIsRepeatable(e.target.checked)}
              />
              <strong>Subscribe to this bundle</strong>
            </label>

            {isRepeatable && (
              <div style={{ marginLeft: '24px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Delivery Frequency:
                  <select
                    value={subscriptionFrequency}
                    onChange={(e) => setSubscriptionFrequency(e.target.value)}
                    style={{ marginLeft: '10px', padding: '5px' }}
                  >
                    <option value="daily">Daily (2% off)</option>
                    <option value="monthly">Monthly (3% off)</option>
                    <option value="yearly">Yearly (5% off)</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>

                {subscriptionFrequency === 'custom' && (
                  <label style={{ display: 'block', marginBottom: '5px' }}>
                    Every
                    <input
                      type="number"
                      min="1"
                      value={customFrequencyDays}
                      onChange={(e) => setCustomFrequencyDays(e.target.value)}
                      style={{ width: '50px', margin: '0 5px' }}
                    />
                    days
                  </label>
                )}

                <div style={{ marginTop: '5px', color: 'green', fontWeight: 'bold' }}>
                  Discount Applied: {calculateDiscount()}%
                </div>
                <small style={{ display: 'block', color: '#666', marginTop: '5px' }}>
                  We will automatically place this order for you based on your selected frequency.
                </small>
              </div>
            )}
          </div>

          <button
            onClick={placeOrder}
            disabled={!savedAddress || cartItems.length === 0}
          >
            Place order
          </button>
        </div>
      )}
    </div>
  );
};

export default CommerceCart;
