import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../../firebase';

const AdminServiceDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [workerAssignments, setWorkerAssignments] = useState({});
  const [prices, setPrices] = useState({});

  useEffect(() => {
    const q = query(
      collection(db, 'serviceRequests'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRequests(data);
    });
    return () => unsub();
  }, []);

  const handleWorkerChange = (id, value) => {
    setWorkerAssignments((prev) => ({ ...prev, [id]: value }));
  };

  const handlePriceChange = (id, value) => {
    setPrices((prev) => ({ ...prev, [id]: value }));
  };

  const assignWorker = async (r) => {
    const workerId = workerAssignments[r.id] || null;
    const basePriceValue = prices[r.id];
    const basePrice =
      basePriceValue !== undefined && basePriceValue !== ''
        ? parseFloat(basePriceValue)
        : null;

    await updateDoc(doc(db, 'serviceRequests', r.id), {
      workerId,
      basePrice,
      status: 'assigned',
    });
  };

  const markCompleted = async (r) => {
    await updateDoc(doc(db, 'serviceRequests', r.id), {
      status: 'completed',
    });
  };

  const rejectRequest = async (r) => {
    await updateDoc(doc(db, 'serviceRequests', r.id), {
      status: 'rejected',
    });
  };

  return (
    <div>
      <h1>Service on Rent (Admin)</h1>
      <p>
        Admin can assign workers, set base pricing, and mark requests as
        completed or rejected.
      </p>

      <ul>
        {requests.map((r) => (
          <li
            key={r.id}
            style={{
              marginBottom: '12px',
              padding: '8px',
              border: '1px solid #ccc',
            }}
          >
            <div>
              <strong>{r.category}</strong> | Status: {r.status}
            </div>
            <div>Customer: {r.customerId}</div>
            <div>Description: {r.description}</div>
            <div>Address: {r.address}</div>
            <div>
              Worker ID:{' '}
              <input
                value={workerAssignments[r.id] ?? r.workerId ?? ''}
                onChange={(e) => handleWorkerChange(r.id, e.target.value)}
                placeholder="worker userId"
              />
            </div>
            <div>
              Base price:{' '}
              <input
                type="number"
                value={
                  prices[r.id] ??
                  (typeof r.basePrice === 'number' ? r.basePrice : '')
                }
                onChange={(e) => handlePriceChange(r.id, e.target.value)}
                placeholder="e.g. 500"
              />{' '}
              INR
            </div>
            <div style={{ marginTop: '4px' }}>
              <button onClick={() => assignWorker(r)}>Assign / Update</button>
              <button
                onClick={() => markCompleted(r)}
                style={{ marginLeft: '8px' }}
              >
                Mark completed
              </button>
              <button
                onClick={() => rejectRequest(r)}
                style={{ marginLeft: '8px' }}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminServiceDashboard;
