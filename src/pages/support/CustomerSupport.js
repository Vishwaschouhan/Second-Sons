import React, { useState, useEffect } from 'react';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    serverTimestamp,
    onSnapshot,
    updateDoc,
    doc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import ChatWindow from '../../components/ChatWindow';

const CATEGORIES = ['Commerce', 'Cab', 'Service', 'Housing', 'Medical'];

const CustomerSupport = () => {
    const { user } = useAuth();
    const [step, setStep] = useState(1); // 1: Category, 2: Order, 3: Description
    const [selectedCategory, setSelectedCategory] = useState('');
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [description, setDescription] = useState('');
    const [myCases, setMyCases] = useState([]);
    const [activeChatCaseId, setActiveChatCaseId] = useState(null);

    // Feedback state
    const [feedbackRating, setFeedbackRating] = useState(5);
    const [feedbackComment, setFeedbackComment] = useState('');
    const [feedbackCaseId, setFeedbackCaseId] = useState(null);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'supportCases'),
            where('customerId', '==', user.uid)
        );
        const unsub = onSnapshot(q, (snapshot) => {
            const cases = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            // Client-side sort
            cases.sort((a, b) => {
                const tA = a.createdAt?.toMillis() || 0;
                const tB = b.createdAt?.toMillis() || 0;
                return tB - tA; // Descending
            });
            setMyCases(cases);
        });
        return () => unsub();
    }, [user]);

    const fetchOrders = async (category) => {
        let colName = '';
        if (category === 'Commerce') colName = 'commerceOrders';
        else if (category === 'Cab') colName = 'cabRequests';
        else if (category === 'Service') colName = 'serviceRequests';
        else if (category === 'Housing') colName = 'bookings';
        else if (category === 'Medical') colName = 'medicalConsultations';

        if (!colName) return;

        const q = query(collection(db, colName), where('customerId', '==', user.uid));
        const snap = await getDocs(q);
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };

    const handleCategorySelect = (cat) => {
        setSelectedCategory(cat);
        fetchOrders(cat);
        setStep(2);
    };

    const handleOrderSelect = (order) => {
        setSelectedOrder(order);
        setStep(3);
    };

    const createCase = async () => {
        if (!description.trim()) return;

        const supportId = `SUP-${Date.now().toString().slice(-6)}`;

        await addDoc(collection(db, 'supportCases'), {
            supportId,
            customerId: user.uid,
            agentId: null,
            category: selectedCategory,
            orderId: selectedOrder.id,
            description,
            status: 'open',
            createdAt: serverTimestamp(),
            internalNotes: '',
            feedback: null,
        });

        alert(`Case created! Support ID: ${supportId}`);
        setStep(1);
        setSelectedCategory('');
        setOrders([]);
        setSelectedOrder(null);
        setDescription('');
    };

    const submitFeedback = async () => {
        if (!feedbackCaseId) return;
        await updateDoc(doc(db, 'supportCases', feedbackCaseId), {
            feedback: {
                rating: parseInt(feedbackRating),
                comment: feedbackComment,
            },
        });
        alert('Thank you for your feedback!');
        setFeedbackCaseId(null);
        setFeedbackComment('');
        setFeedbackRating(5);
    };

    const reopenCase = async (caseId) => {
        if (!window.confirm('Reopen this case?')) return;
        await updateDoc(doc(db, 'supportCases', caseId), {
            status: 'open',
            // Keep agentId or clear it? Usually keep if assigned, or clear to pool.
            // Let's keep it for now or clear if we want re-assignment.
            // Requirement: "Support agents can reopen closed cases". 
            // If customer reopens, maybe set status to open.
        });
    };

    return (
        <div style={{ padding: '20px', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
            <h1>Customer Support</h1>

            {/* Create Case Flow */}
            <div style={{ marginBottom: '40px', padding: '20px', border: '1px solid #eee' }}>
                <h2>Report an Issue</h2>
                {step === 1 && (
                    <div>
                        <p>Select a category:</p>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {CATEGORIES.map((cat) => (
                                <button key={cat} onClick={() => handleCategorySelect(cat)}>
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div>
                        <p>Select the order you have an issue with ({selectedCategory}):</p>
                        <button onClick={() => setStep(1)}>Back</button>
                        <ul>
                            {orders.map((o) => (
                                <li key={o.id} style={{ margin: '10px 0' }}>
                                    {/* Display some order details based on category */}
                                    <strong>ID: {o.id}</strong> - {o.status}
                                    <button onClick={() => handleOrderSelect(o)} style={{ marginLeft: '10px' }}>
                                        Select
                                    </button>
                                </li>
                            ))}
                            {orders.length === 0 && <p>No orders found in this category.</p>}
                        </ul>
                    </div>
                )}

                {step === 3 && (
                    <div>
                        <p>Describe your issue for Order ID: {selectedOrder.id}</p>
                        <button onClick={() => setStep(2)}>Back</button>
                        <br /><br />
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            style={{ width: '100%', height: '100px', boxSizing: 'border-box' }}
                            placeholder="Please describe the issue..."
                        />
                        <br /><br />
                        <button onClick={createCase}>Create Case</button>
                    </div>
                )}
            </div>

            {/* My Cases List */}
            <h2>My Support Cases</h2>
            <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
                {myCases.map((c) => (
                    <li key={c.id} style={{ marginBottom: '15px', padding: '10px', border: '1px solid #ccc', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        <div>
                            <strong>{c.supportId}</strong> | {c.category} | Status: {c.status}
                        </div>
                        <div>Description: {c.description}</div>
                        {c.feedback && (
                            <div style={{ color: 'green' }}>
                                Rating: {c.feedback.rating}/5 - "{c.feedback.comment}"
                            </div>
                        )}

                        <div style={{ marginTop: '10px' }}>
                            {/* Chat Button */}
                            <button onClick={() => setActiveChatCaseId(c.id)} style={{ marginRight: '10px' }}>
                                Chat with Support
                            </button>

                            {/* Reopen Button */}
                            {c.status === 'closed' && (
                                <button onClick={() => reopenCase(c.id)} style={{ marginRight: '10px' }}>
                                    Reopen Case
                                </button>
                            )}

                            {/* Feedback Button */}
                            {c.status === 'closed' && !c.feedback && (
                                <button onClick={() => setFeedbackCaseId(c.id)}>
                                    Leave Feedback
                                </button>
                            )}
                        </div>
                    </li>
                ))}
                {myCases.length === 0 && <p>No support cases yet.</p>}
            </ul>

            {/* Chat Window */}
            {activeChatCaseId && (
                <ChatWindow
                    requestId={activeChatCaseId}
                    currentUser={user}
                    onClose={() => setActiveChatCaseId(null)}
                />
            )}

            {/* Feedback Modal (Simple inline for now) */}
            {feedbackCaseId && (
                <div style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    backgroundColor: 'white', padding: '20px', border: '1px solid black', zIndex: 1000,
                    width: '90%', maxWidth: '400px', boxSizing: 'border-box', borderRadius: '8px'
                }}>
                    <h3>Rate Support</h3>
                    <label>
                        Rating:
                        <select value={feedbackRating} onChange={(e) => setFeedbackRating(e.target.value)}>
                            <option value="1">1 - Poor</option>
                            <option value="2">2 - Fair</option>
                            <option value="3">3 - Good</option>
                            <option value="4">4 - Very Good</option>
                            <option value="5">5 - Excellent</option>
                        </select>
                    </label>
                    <br /><br />
                    <textarea
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        placeholder="Comment..."
                        style={{ width: '100%', height: '60px' }}
                    />
                    <br /><br />
                    <button onClick={submitFeedback}>Submit</button>
                    <button onClick={() => setFeedbackCaseId(null)} style={{ marginLeft: '10px' }}>Cancel</button>
                </div>
            )}
        </div>
    );
};

export default CustomerSupport;
