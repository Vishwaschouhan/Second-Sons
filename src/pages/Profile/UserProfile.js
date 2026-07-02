import React, { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { SERVICE_CATEGORIES } from '../../serviceCategories';

const UserProfile = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [expertiseCategory, setExpertiseCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
      setExpertiseCategory(profile.expertiseCategory || '');
    }
  }, [profile]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !profile) {
    return <div>No user loaded.</div>;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const updateData = {
        name,
        phone,
        address,
      };

      if (profile.role === 'WORKER') {
        updateData.expertiseCategory = expertiseCategory || '';
      }

      await updateDoc(doc(db, 'users', user.uid), updateData);
      await refreshProfile();
      setMessage('Profile updated.');
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1>My Profile</h1>
      <p>Role: {profile.role}</p>

      <form
        onSubmit={onSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '320px',
        }}
      >
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label>
          Mobile number
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9876543210"
          />
        </label>

        <label>
          Address
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Your default address"
          />
        </label>

        {profile.role === 'WORKER' && (
          <label>
            Expertise category
            <select
              value={expertiseCategory}
              onChange={(e) => setExpertiseCategory(e.target.value)}
            >
              <option value="">Select category</option>
              {SERVICE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      {message && <p style={{ marginTop: '8px' }}>{message}</p>}
    </div>
  );
};

export default UserProfile;
