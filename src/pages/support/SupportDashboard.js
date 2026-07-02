import React, { useState, useEffect } from 'react';
import {
    collection,
    query,
    where,
    onSnapshot,
    updateDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import ChatWindow from '../../components/ChatWindow';

const SupportDashboard = () => {
    const { user } = useAuth();
    const [unassignedCases, setUnassignedCases] = useState([]);
    const [myCases, setMyCases] = useState([]);
    const [activeChatCaseId, setActiveChatCaseId] = useState(null);
    const [providerChatCaseId, setProviderChatCaseId] = useState(null);
    const [searchId, setSearchId] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    // Internal notes state
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [tempNote, setTempNote] = useState('');

    useEffect(() => {
        if (!user) return;

        // Unassigned cases
        const qUnassigned = query(
            collection(db, 'supportCases'),
            where('status', '==', 'open'),
            where('agentId', '==', null)
        );
        const unsubUnassigned = onSnapshot(qUnassigned, (snapshot) => {
            setUnassignedCases(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });

        // My cases
        const qMy = query(
            collection(db, 'supportCases'),
            where('agentId', '==', user.uid)
        );
        const unsubMy = onSnapshot(qMy, (snapshot) => {
            setMyCases(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });

        return () => {
            unsubUnassigned();
            unsubMy();
        };
    }, [user]);

    const acceptCase = async (caseId) => {
        await updateDoc(doc(db, 'supportCases', caseId), {
            agentId: user.uid,
            status: 'assigned',
        });
    };

    const closeCase = async (caseId) => {
        if (!window.confirm('Close this case?')) return;
        await updateDoc(doc(db, 'supportCases', caseId), {
            status: 'closed',
        });
    };

    const reopenCase = async (caseId) => {
        if (!window.confirm('Reopen this case?')) return;
        await updateDoc(doc(db, 'supportCases', caseId), {
            status: 'assigned', // Reopen as assigned to me
        });
    };

    const saveInternalNote = async (caseId) => {
        await updateDoc(doc(db, 'supportCases', caseId), {
            internalNotes: tempNote,
        });
        setEditingNoteId(null);
        setTempNote('');
    };

    const startProviderChat = async (caseId, providerId, role) => {
        if (!providerId) {
            alert('Provider ID not found for this case.');
            return;
        }
        const chatId = `support_${caseId}_${providerId}`;

        // Create/Update chat document to ensure it exists and has metadata
        // We use setDoc with merge to avoid overwriting existing data if any
        await setDoc(doc(db, 'chats', chatId), {
            type: 'support',
            participants: [user.uid, providerId],
            caseId: caseId,
            providerRole: role,
            updatedAt: serverTimestamp(),
        }, { merge: true });

        setProviderChatCaseId(chatId);
    };

    const fetchOrderAndChat = async (c, role) => {
        // We need to fetch the order to get the provider ID.
        // This is a bit inefficient to do on click, but saves storing it in the case.
        // Better: store providerId in the case when creating it? 
        // Or just fetch here. Let's fetch here.

        let colName = '';
        if (c.category === 'Commerce') colName = 'commerceOrders';
        else if (c.category === 'Cab') colName = 'cabRequests';
        else if (c.category === 'Service') colName = 'serviceRequests';
        else if (c.category === 'Housing') colName = 'bookings';
        else if (c.category === 'Medical') colName = 'medicalConsultations';

        if (!colName || !c.orderId) return;

        const orderSnap = await getDoc(doc(db, colName, c.orderId));
        if (!orderSnap.exists()) {
            alert('Order not found');
            return;
        }
        const order = orderSnap.data();

        let providerId = null;
        if (role === 'SHOP') providerId = order.shopId;
        else if (role === 'DELIVERY') providerId = order.deliveryId; // Assuming deliveryId is on order
        else if (role === 'DRIVER') providerId = order.driverId || order.proposedByDriverId; // Check Cab schema
        else if (role === 'WORKER') providerId = order.workerId;
        else if (role === 'HOST') providerId = order.hostId;
        else if (role === 'DOCTOR') providerId = order.doctorId;

        if (providerId) {
            startProviderChat(c.id, providerId, role);
        } else {
            alert(`Provider (${role}) not assigned or found for this order.`);
        }
    };

    const handleSearch = async () => {
        if (!searchId.trim()) {
            setSearchResults([]);
            return;
        }
        // Simple search by supportId
        const q = query(
            collection(db, 'supportCases'),
            where('supportId', '==', searchId.trim())
        );
        // Note: Firestore requires index for some queries, but equality on one field is fine.
        // However, getting docs once is better for search.
        // Let's try to find it in unassigned or my cases first, or fetch from DB.
        // Since we want global search, we should fetch.
        // But for simplicity in this prototype, let's just filter locally if we had all cases, 
        // or do a specific fetch.
        // Let's do a fetch.
        // Actually, onSnapshot is better for real-time, but for search, getDocs is fine.
        const snap = await getDocs(q);
        setSearchResults(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>Support Dashboard</h1>

            {/* Search */}
            <div style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    placeholder="Search by Support ID (e.g., SUP-123456)"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                    style={{ padding: '8px', width: '300px' }}
                />
                <button onClick={handleSearch} style={{ marginLeft: '10px' }}>Search</button>
            </div>

            {searchResults.length > 0 && (
                <div style={{ marginBottom: '20px', border: '1px solid blue', padding: '10px' }}>
                    <h3>Search Results</h3>
                    <ul>
                        {searchResults.map((c) => (
                            <li key={c.id}>
                                {c.supportId} - {c.status} - Agent: {c.agentId || 'None'}
                                {/* Add actions if needed, or just view */}
                            </li>
                        ))}
                    </ul>
                    <button onClick={() => setSearchResults([])}>Clear Search</button>
                </div>
            )}

            <div style={{ display: 'flex', gap: '20px' }}>
                {/* Unassigned Cases */}
                <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px' }}>
                    <h2>Unassigned Cases</h2>
                    <ul>
                        {unassignedCases.map((c) => (
                            <li key={c.id} style={{ marginBottom: '10px', padding: '5px', borderBottom: '1px solid #eee' }}>
                                <div><strong>{c.supportId}</strong> ({c.category})</div>
                                <div>{c.description}</div>
                                <button onClick={() => acceptCase(c.id)} style={{ marginTop: '5px' }}>
                                    Accept Case
                                </button>
                            </li>
                        ))}
                        {unassignedCases.length === 0 && <p>No unassigned cases.</p>}
                    </ul>
                </div>

                {/* My Cases */}
                <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px' }}>
                    <h2>My Cases</h2>
                    <ul>
                        {myCases.map((c) => (
                            <li key={c.id} style={{ marginBottom: '15px', padding: '10px', border: '1px solid #eee', backgroundColor: c.status === 'closed' ? '#f9f9f9' : 'white' }}>
                                <div>
                                    <strong>{c.supportId}</strong> ({c.category}) | Status: {c.status}
                                </div>
                                <div style={{ margin: '5px 0' }}>Issue: {c.description}</div>

                                {/* Internal Notes */}
                                <div style={{ margin: '10px 0', padding: '5px', backgroundColor: '#fffec8' }}>
                                    <strong>Internal Notes:</strong>
                                    {editingNoteId === c.id ? (
                                        <div>
                                            <textarea
                                                value={tempNote}
                                                onChange={(e) => setTempNote(e.target.value)}
                                                style={{ width: '100%', height: '60px' }}
                                            />
                                            <button onClick={() => saveInternalNote(c.id)}>Save</button>
                                            <button onClick={() => setEditingNoteId(null)}>Cancel</button>
                                        </div>
                                    ) : (
                                        <div onClick={() => { setEditingNoteId(c.id); setTempNote(c.internalNotes || ''); }} style={{ cursor: 'pointer', minHeight: '20px' }}>
                                            {c.internalNotes || 'Click to add notes...'}
                                        </div>
                                    )}
                                </div>

                                {/* Feedback Display */}
                                {c.feedback && (
                                    <div style={{ color: 'green', marginBottom: '5px' }}>
                                        <strong>Customer Feedback:</strong> {c.feedback.rating}/5 - "{c.feedback.comment}"
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                    <button onClick={() => setActiveChatCaseId(c.id)}>
                                        Chat Customer
                                    </button>

                                    {/* Provider Chat Buttons */}
                                    {c.category === 'Commerce' && (
                                        <>
                                            <button onClick={() => fetchOrderAndChat(c, 'SHOP')}>Chat Shop</button>
                                            <button onClick={() => fetchOrderAndChat(c, 'DELIVERY')}>Chat Delivery</button>
                                        </>
                                    )}
                                    {c.category === 'Cab' && (
                                        <button onClick={() => fetchOrderAndChat(c, 'DRIVER')}>Chat Driver</button>
                                    )}
                                    {c.category === 'Service' && (
                                        <button onClick={() => fetchOrderAndChat(c, 'WORKER')}>Chat Worker</button>
                                    )}
                                    {c.category === 'Housing' && (
                                        <button onClick={() => fetchOrderAndChat(c, 'HOST')}>Chat Host</button>
                                    )}
                                    {c.category === 'Medical' && (
                                        <button onClick={() => fetchOrderAndChat(c, 'DOCTOR')}>Chat Doctor</button>
                                    )}

                                    {c.status !== 'closed' ? (
                                        <button onClick={() => closeCase(c.id)} style={{ backgroundColor: '#ffcccc' }}>
                                            Close Case
                                        </button>
                                    ) : (
                                        <button onClick={() => reopenCase(c.id)} style={{ backgroundColor: '#ccffcc' }}>
                                            Reopen Case
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                        {myCases.length === 0 && <p>No cases assigned to you.</p>}
                    </ul>
                </div>
            </div>

            {/* Chat Window - Customer */}
            {activeChatCaseId && (
                <ChatWindow
                    requestId={activeChatCaseId}
                    currentUser={user}
                    onClose={() => setActiveChatCaseId(null)}
                    title="Customer Chat"
                />
            )}

            {/* Chat Window - Provider */}
            {providerChatCaseId && (
                <ChatWindow
                    requestId={providerChatCaseId}
                    currentUser={user}
                    onClose={() => setProviderChatCaseId(null)}
                    title="Provider Chat (Internal)"
                />
            )}
        </div>
    );
};

export default SupportDashboard;
