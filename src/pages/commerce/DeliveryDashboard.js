import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';



const DeliveryDashboard = () => {
  const { user } = useAuth();
  const [availableOrders, setAvailableOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [customerProfiles, setCustomerProfiles] = useState({});
  const [shopProfiles, setShopProfiles] = useState({});

  useEffect(() => {
    if (!user) return;

    const qAvailable = query(
      collection(db, 'commerceOrders'),
      where('status', '==', 'ready_for_delivery'),
      where('deliveryPartnerId', '==', null)
    );
    const unsubAvailable = onSnapshot(qAvailable, (snapshot) => {
      setAvailableOrders(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    });

    const qMine = query(
      collection(db, 'commerceOrders'),
      where('deliveryPartnerId', '==', user.uid)
    );
    const unsubMine = onSnapshot(qMine, (snapshot) => {
      setMyOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubAvailable();
      unsubMine();
    };
  }, [user]);

  useEffect(() => {
    const loadProfiles = async () => {
      const allOrders = [...availableOrders, ...myOrders];

      const customerIds = Array.from(
        new Set(allOrders.map((o) => o.customerId).filter(Boolean))
      );
      const shopIds = Array.from(
        new Set(allOrders.map((o) => o.shopId).filter(Boolean))
      );

      const customerMap = {};
      for (const id of customerIds) {
        try {
          const snap = await getDoc(doc(db, 'users', id));
          if (snap.exists()) {
            customerMap[id] = snap.data();
          }
        } catch (err) {
          console.error('Failed to fetch customer profile', err);
        }
      }

      const shopMap = {};
      for (const id of shopIds) {
        try {
          const snap = await getDoc(doc(db, 'users', id));
          if (snap.exists()) {
            shopMap[id] = snap.data();
          }
        } catch (err) {
          console.error('Failed to fetch shop profile', err);
        }
      }

      setCustomerProfiles(customerMap);
      setShopProfiles(shopMap);
    };

    if (availableOrders.length > 0 || myOrders.length > 0) {
      loadProfiles();
    } else {
      setCustomerProfiles({});
      setShopProfiles({});
    }
  }, [availableOrders, myOrders]);

  const acceptDelivery = async (order) => {
    await updateDoc(doc(db, 'commerceOrders', order.id), {
      deliveryPartnerId: user.uid,
      status: 'accepted_by_delivery',
    });
  };

  const markPickedUp = async (order) => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    await updateDoc(doc(db, 'commerceOrders', order.id), {
      status: 'out_for_delivery',
      deliveryOtp: otp,
    });
    alert(`Order picked up! OTP generated.`);
  };

  const [otpInputs, setOtpInputs] = useState({});

  const handleOtpChange = (orderId, value) => {
    setOtpInputs((prev) => ({ ...prev, [orderId]: value }));
  };

  const markDelivered = async (order) => {
    if (order.status !== 'out_for_delivery') return;

    const enteredOtp = otpInputs[order.id];
    if (!enteredOtp) {
      alert('Please enter the OTP provided by the customer.');
      return;
    }

    if (enteredOtp !== order.deliveryOtp) {
      alert('Incorrect OTP. Please try again.');
      return;
    }

    await updateDoc(doc(db, 'commerceOrders', order.id), {
      status: 'delivered',
    });
    alert('Order delivered successfully!');
  };

  return (
    <div>
      <h1>Delivery Dashboard</h1>

      <h2>Available deliveries</h2>
      <ul>
        {availableOrders.map((o) => {
          const customer = customerProfiles[o.customerId];
          const shop = shopProfiles[o.shopId];
          return (
            <li
              key={o.id}
              style={{
                marginBottom: '8px',
                padding: '6px',
                border: '1px solid #ccc',
              }}
            >
              <div>Order: {o.id}</div>
              <div>
                Shop:{' '}
                {shop ? shop.name : o.shopId}
                {shop?.address && ` | Address: ${shop.address}`}
              </div>
              <div>Pickup from shop above</div>
              <div>
                Customer:{' '}
                {customer ? customer.name : o.customerId}
                {customer?.phone &&
                  ` (Phone: ${customer.phone})`}
              </div>
              <div>Delivery address: {o.address}</div>
              <button onClick={() => acceptDelivery(o)}>
                Accept delivery
              </button>
            </li>
          );
        })}
        {availableOrders.length === 0 && (
          <p>No available deliveries right now.</p>
        )}
      </ul>

      <h2>Your deliveries</h2>
      <ul>
        {myOrders.map((o) => {
          const customer = customerProfiles[o.customerId];
          const shop = shopProfiles[o.shopId];
          return (
            <li
              key={o.id}
              style={{
                marginBottom: '8px',
                padding: '6px',
                border: '1px solid #ccc',
              }}
            >
              <div>Order: {o.id}</div>
              <div>Status: {o.status}</div>
              <div>
                Shop:{' '}
                {shop ? shop.name : o.shopId}
                {shop?.address && ` | Address: ${shop.address}`}
              </div>
              <div>
                Customer:{' '}
                {customer ? customer.name : o.customerId}
                {customer?.phone &&
                  ` (Phone: ${customer.phone})`}
              </div>
              <div>Delivery address: {o.address}</div>

              {o.status === 'accepted_by_delivery' && (
                <button onClick={() => markPickedUp(o)}>
                  Pick Up (Generate OTP)
                </button>
              )}

              {o.status === 'out_for_delivery' && (
                <div style={{ marginTop: '10px' }}>
                  <input
                    type="text"
                    placeholder="Enter Customer OTP"
                    value={otpInputs[o.id] || ''}
                    onChange={(e) => handleOtpChange(o.id, e.target.value)}
                    style={{ marginRight: '10px', padding: '5px' }}
                  />
                  <button onClick={() => markDelivered(o)}>
                    Verify & Deliver
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {myOrders.length === 0 && <p>No assigned deliveries yet.</p>}
      </ul>
    </div>
  );
};

export default DeliveryDashboard;
