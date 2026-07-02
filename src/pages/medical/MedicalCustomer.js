import React, { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';

const MedicalCustomer = () => {
  const { user } = useAuth();
  const [symptoms, setSymptoms] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        setMedicalHistory(snap.data().medicalHistory || '');
      }
    };
    loadProfile();
  }, [user]);

  const saveMedicalHistory = async () => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), {
      medicalHistory,
    });
    alert('Medical history updated!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!symptoms) return;

    await addDoc(collection(db, 'medicalConsultations'), {
      customerId: user.uid,
      doctorId: null,
      symptoms,
      preferredTime: preferredTime || null,
      status: 'pending',
      notes: '',
      prescription: '',
      createdAt: serverTimestamp(),
    });

    setSymptoms('');
    setPreferredTime('');
  };

  return (
    <div>
      <h1>Medical Consultation (Customer)</h1>

      <div
        style={{
          marginBottom: '20px',
          padding: '10px',
          border: '1px solid #ccc',
          backgroundColor: '#f9f9f9',
          maxWidth: '400px',
        }}
      >
        <h3>Your Medical History</h3>
        <p>Doctors will see this when you request a consultation.</p>
        <textarea
          value={medicalHistory}
          onChange={(e) => setMedicalHistory(e.target.value)}
          style={{ width: '100%', height: '60px', marginBottom: '8px' }}
          placeholder="Allergies, past surgeries, chronic conditions..."
        />
        <button onClick={saveMedicalHistory}>Save History</button>
      </div>

      <p>Your consultations are available in the "My Orders" page.</p>

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
          Describe your symptoms
          <textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            required
          />
        </label>

        <label>
          Preferred time (optional)
          <input
            type="datetime-local"
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
          />
        </label>

        <button type="submit">Request consultation</button>
      </form>
    </div>
  );
};

export default MedicalCustomer;
