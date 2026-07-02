import React, { useState } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { SERVICE_CATEGORIES } from '../../serviceCategories';

const CustomerServiceRequest = () => {
  const { user, profile, loading } = useAuth();
  const [category, setCategory] = useState(
    SERVICE_CATEGORIES[0] || ''
  );
  const [description, setDescription] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [error, setError] = useState('');

  if (loading || !profile) {
    return <div>Loading...</div>;
  }

  const savedAddress = profile.address || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!category || !description) return;

    if (!savedAddress) {
      setError(
        'Please set your address in My Profile before creating a service request.'
      );
      return;
    }

    try {
      await addDoc(collection(db, 'serviceRequests'), {
        customerId: user.uid,
        category,
        description,
        address: savedAddress,
        scheduledTime: scheduledTime || null,
        status: 'pending', // pending, quoted, accepted, completed, cancelled
        workerId: null,
        proposedPrice: null,
        proposedByWorkerId: null,
        createdAt: serverTimestamp(),
      });

      setDescription('');
      setScheduledTime('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create service request');
    }
  };

  return (
    <div>
      <h1>Service on Rent (Customer)</h1>
      <p>Your service requests are available in the "My Orders" page.</p>

      <p>
        <strong>Using your saved address:</strong>{' '}
        {savedAddress
          ? savedAddress
          : 'No address set. Go to "My Profile" and set your address.'}
      </p>

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
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            {SERVICE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>

        <label>
          Problem description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>

        <label>
          Preferred time (optional)
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
          />
        </label>

        <button
          type="submit"
          disabled={!savedAddress}
        >
          Create service request
        </button>
      </form>

      {error && (
        <p style={{ color: 'red', marginTop: '8px' }}>{error}</p>
      )}
    </div>
  );
};

export default CustomerServiceRequest;
