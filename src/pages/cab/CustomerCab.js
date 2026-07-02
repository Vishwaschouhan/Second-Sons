import React, { useState } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';

const CustomerCab = () => {
  const { user } = useAuth();
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pickupLocation || !dropLocation) return;

    await addDoc(collection(db, 'cabRequests'), {
      customerId: user.uid,
      pickupLocation,
      dropLocation,
      scheduledTime: scheduledTime || null,
      notes: notes || '',
      status: 'pending',
      driverId: null,
      createdAt: serverTimestamp(),
    });

    setPickupLocation('');
    setDropLocation('');
    setScheduledTime('');
    setNotes('');
  };

  return (
    <div>
      <h1>Cab Booking (Customer)</h1>
      <p>Your cab bookings are available in the "My Orders" page.</p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '400px',
        }}
      >
        <label>
          Pickup location
          <input
            value={pickupLocation}
            onChange={(e) => setPickupLocation(e.target.value)}
            required
          />
        </label>

        <label>
          Drop location
          <input
            value={dropLocation}
            onChange={(e) => setDropLocation(e.target.value)}
            required
          />
        </label>

        <label>
          Scheduled time (optional)
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
          />
        </label>

        <label>
          Notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <button type="submit">Create cab request</button>
      </form>
    </div>
  );
};

export default CustomerCab;
