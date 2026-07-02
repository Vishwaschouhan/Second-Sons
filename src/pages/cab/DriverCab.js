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

import ChatWindow from '../../components/ChatWindow';



const DriverCab = () => {
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [myRides, setMyRides] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [customerProfiles, setCustomerProfiles] = useState({});
  const [activeChatRequestId, setActiveChatRequestId] = useState(null);

  useEffect(() => {
    if (!user) return;

    // We want pending requests OR requests quoted by THIS driver
    // Firestore "OR" queries can be tricky, so we might just listen to all non-completed/accepted?
    // Or just listen to 'pending' and 'quoted' separately or together if index allows.
    // For simplicity, let's listen to all requests that are NOT accepted/completed/cancelled?
    // Or just listen to 'pending' ones + 'quoted' ones where driverId matches?
    // Let's stick to the pattern in WorkerDashboard:
    // 1. Query for pending (everyone sees these)
    // 2. Query for quoted (but we need to filter client-side or complex query)

    // Actually, WorkerDashboard filters client-side from a category query.
    // Here we don't have a category. We probably want to see ALL pending requests.

    const qPending = query(
      collection(db, 'cabRequests'),
      where('status', 'in', ['pending', 'quoted'])
    );

    const unsubPending = onSnapshot(qPending, (snapshot) => {
      const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = all.filter(r => {
        if (r.status === 'pending') return true;
        if (r.status === 'quoted' && r.proposedByDriverId === user.uid) return true;
        return false;
      });
      setPendingRequests(filtered);
    });

    const qMine = query(
      collection(db, 'cabRequests'),
      where('driverId', '==', user.uid)
    );
    const unsubMine = onSnapshot(qMine, (snapshot) => {
      setMyRides(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubPending();
      unsubMine();
    };
  }, [user]);

  const handleQuoteChange = (id, value) => {
    setQuotes((prev) => ({ ...prev, [id]: value }));
  };

  const sendQuote = async (request) => {
    const priceStr = quotes[request.id];
    // If updating an existing quote and no new value typed, use existing
    const finalPrice = priceStr ? parseFloat(priceStr) : request.proposedPrice;

    if (!finalPrice || finalPrice <= 0) return;

    await updateDoc(doc(db, 'cabRequests', request.id), {
      proposedPrice: finalPrice,
      proposedByDriverId: user.uid,
      status: 'quoted',
    });
  };

  useEffect(() => {
    const loadCustomers = async () => {
      const ids = Array.from(
        new Set(
          myRides
            .map((r) => r.customerId)
            .filter(Boolean)
        )
      );
      const profiles = {};
      for (const id of ids) {
        try {
          const snap = await getDoc(doc(db, 'users', id));
          if (snap.exists()) {
            profiles[id] = snap.data();
          }
        } catch (err) {
          console.error('Failed to fetch customer profile', err);
        }
      }
      setCustomerProfiles(profiles);
    };

    if (myRides.length > 0) {
      loadCustomers();
    } else {
      setCustomerProfiles({});
    }
  }, [myRides]);



  const generateOtp = async (request) => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    await updateDoc(doc(db, 'cabRequests', request.id), {
      rideOtp: otp,
    });
    alert('OTP generated! Ask customer for OTP to start ride.');
  };

  const [otpInputs, setOtpInputs] = useState({});

  const handleOtpChange = (id, value) => {
    setOtpInputs((prev) => ({ ...prev, [id]: value }));
  };

  const verifyAndStartRide = async (request) => {
    const enteredOtp = otpInputs[request.id];
    if (!enteredOtp) {
      alert('Please enter the OTP provided by the customer.');
      return;
    }

    if (enteredOtp !== request.rideOtp) {
      alert('Incorrect OTP. Please try again.');
      return;
    }

    await updateDoc(doc(db, 'cabRequests', request.id), {
      status: 'in_progress',
    });
    alert('Ride started!');
  };

  const endRide = async (request) => {
    if (request.status !== 'in_progress') return;
    await updateDoc(doc(db, 'cabRequests', request.id), {
      status: 'completed',
    });
    alert('Ride completed successfully!');
  };

  return (
    <div>
      <h1>Cab Dashboard (Driver)</h1>

      <h2>Pending cab requests</h2>
      <ul>
        {pendingRequests.map((r) => (
          <li key={r.id} style={{ marginBottom: '8px' }}>
            {r.pickupLocation} → {r.dropLocation}{' '}
            {r.scheduledTime && <span>| Time: {r.scheduledTime}</span>}
            <div style={{ marginTop: '4px' }}>
              <label>
                Your price (₹)
                <input
                  type="number"
                  value={quotes[r.id] ?? (r.proposedPrice || '')}
                  onChange={(e) => handleQuoteChange(r.id, e.target.value)}
                  style={{ marginLeft: '4px', width: '80px' }}
                />
              </label>
              <button
                onClick={() => sendQuote(r)}
                style={{ marginLeft: '8px' }}
              >
                {r.status === 'quoted' ? 'Update quote' : 'Send quote'}
              </button>
              {r.status === 'quoted' && r.proposedByDriverId === user.uid && (
                <button
                  onClick={() => setActiveChatRequestId(r.id)}
                  style={{ marginLeft: '8px' }}
                >
                  Chat
                </button>
              )}
            </div>
          </li>
        ))}
        {pendingRequests.length === 0 && <p>No pending cab requests.</p>}
      </ul>

      <h2>Your rides</h2>
      <ul>
        {myRides.map((r) => {
          const showContact = r.status === 'accepted';
          const customer = showContact
            ? customerProfiles[r.customerId]
            : null;

          return (
            <li key={r.id} style={{ marginBottom: '8px' }}>
              {r.pickupLocation} → {r.dropLocation} | Status: {r.status}
              {showContact && (
                <div>
                  Customer:{' '}
                  {customer ? customer.name : r.customerId}
                  {customer?.phone &&
                    ` (Phone: ${customer.phone})`}
                </div>
              )}
              <div style={{ marginTop: '4px' }}>
                {r.status === 'accepted' && !r.rideOtp && (
                  <button
                    onClick={() => generateOtp(r)}
                    style={{ marginRight: '8px' }}
                  >
                    Arrived (Generate OTP)
                  </button>
                )}

                {r.status === 'accepted' && r.rideOtp && (
                  <div style={{ marginTop: '10px' }}>
                    <input
                      type="text"
                      placeholder="Enter Customer OTP"
                      value={otpInputs[r.id] || ''}
                      onChange={(e) => handleOtpChange(r.id, e.target.value)}
                      style={{ marginRight: '10px', padding: '5px' }}
                    />
                    <button onClick={() => verifyAndStartRide(r)}>
                      Start Ride
                    </button>
                  </div>
                )}

                {r.status === 'in_progress' && (
                  <button onClick={() => endRide(r)} style={{ backgroundColor: '#f44336', color: 'white' }}>
                    End Ride
                  </button>
                )}

                {(r.status === 'accepted' || r.status === 'in_progress') && (
                  <button onClick={() => setActiveChatRequestId(r.id)} style={{ marginLeft: '8px' }}>
                    Chat
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {myRides.length === 0 && <p>No rides yet.</p>}
      </ul>

      {activeChatRequestId && (
        <ChatWindow
          requestId={activeChatRequestId}
          currentUser={user}
          onClose={() => setActiveChatRequestId(null)}
        />
      )}
    </div>
  );
};

export default DriverCab;
