import React, { useEffect, useState } from 'react';
import {
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    onSnapshot,
    updateDoc,
    doc,
    getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { uploadToCloudinary } from '../../utils/cloudinaryUtils';

const PharmacyDashboard = () => {
    const { user } = useAuth();

    const [name, setName] = useState('');
    const [dose, setDose] = useState('');
    const [brand, setBrand] = useState('');
    const [genericName, setGenericName] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [price, setPrice] = useState('');
    const [stock, setStock] = useState('');

    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [customerProfiles, setCustomerProfiles] = useState({});
    const [rejectionReason, setRejectionReason] = useState({});
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState({});

    useEffect(() => {
        // Fetch doctors
        const qDoctors = query(
            collection(db, 'users'),
            where('role', '==', 'DOCTOR')
        );
        const unsubDoctors = onSnapshot(qDoctors, (snapshot) => {
            setDoctors(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        return () => unsubDoctors();
    }, []);

    useEffect(() => {
        if (!user) return;

        const qProducts = query(
            collection(db, 'products'),
            where('shopId', '==', user.uid)
        );
        const unsubProducts = onSnapshot(qProducts, (snapshot) => {
            setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });

        const qOrders = query(
            collection(db, 'commerceOrders'),
            where('shopId', '==', user.uid)
        );
        const unsubOrders = onSnapshot(qOrders, (snapshot) => {
            setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });

        return () => {
            unsubProducts();
            unsubOrders();
        };
    }, [user]);

    useEffect(() => {
        const loadCustomers = async () => {
            const ids = Array.from(
                new Set(orders.map((o) => o.customerId).filter(Boolean))
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

        if (orders.length > 0) {
            loadCustomers();
        } else {
            setCustomerProfiles({});
        }
    }, [orders]);

    const addMedicine = async (e) => {
        e.preventDefault();
        if (!name || !price || !expiryDate) return;

        await addDoc(collection(db, 'products'), {
            shopId: user.uid,
            name,
            dose,
            brand,
            genericName,
            batchNumber,
            expiryDate,
            price: parseFloat(price),
            stock: stock ? parseInt(stock, 10) : 0,
            isAvailable: true,
            type: 'medicine',
            createdAt: serverTimestamp(),
        });

        setName('');
        setDose('');
        setBrand('');
        setGenericName('');
        setBatchNumber('');
        setExpiryDate('');
        setPrice('');
        setStock('');
    };

    const toggleAvailability = async (product) => {
        try {
            await updateDoc(doc(db, 'products', product.id), {
                isAvailable: !product.isAvailable,
            });
            alert(`Availability toggled to ${!product.isAvailable ? 'Available' : 'Unavailable'}`);
        } catch (err) {
            console.error('Failed to toggle availability:', err);
            alert('Failed to toggle availability: ' + err.message);
        }
    };

    const updateOrderStatus = async (order, status, reason = null) => {
        try {
            const updateData = { status };
            if (reason) updateData.rejectionReason = reason;
            await updateDoc(doc(db, 'commerceOrders', order.id), updateData);
        } catch (err) {
            console.error('Failed to update order status:', err);
            alert('Failed to update order status: ' + err.message);
        }
    };

    const handleRejectionReasonChange = (orderId, value) => {
        setRejectionReason(prev => ({ ...prev, [orderId]: value }));
    };

    const isExpired = (dateString) => {
        if (!dateString) return false;
        return new Date(dateString) < new Date();
    };

    const forwardToDoctor = async (order) => {
        const doctorId = selectedDoctor[order.id];
        if (!doctorId) {
            alert('Please select a doctor to forward to.');
            return;
        }
        try {
            await updateDoc(doc(db, 'commerceOrders', order.id), {
                status: 'pending_doctor_approval',
                forwardedToDoctorId: doctorId,
            });
            alert('Order forwarded to doctor successfully!');
        } catch (err) {
            console.error('Failed to forward to doctor:', err);
            alert('Failed to forward to doctor: ' + err.message);
        }
    };

    const [editingProduct, setEditingProduct] = useState(null);
    const [editName, setEditName] = useState('');
    const [editDose, setEditDose] = useState('');
    const [editBrand, setEditBrand] = useState('');
    const [editGenericName, setEditGenericName] = useState('');
    const [editBatchNumber, setEditBatchNumber] = useState('');
    const [editExpiryDate, setEditExpiryDate] = useState('');
    const [editPrice, setEditPrice] = useState('');
    const [editStock, setEditStock] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editImages, setEditImages] = useState([]);
    const [uploading, setUploading] = useState(false);

    const startEditing = (product) => {
        setEditingProduct(product);
        setEditName(product.name);
        setEditDose(product.dose || '');
        setEditBrand(product.brand || '');
        setEditGenericName(product.genericName || '');
        setEditBatchNumber(product.batchNumber || '');
        setEditExpiryDate(product.expiryDate || '');
        setEditPrice(product.price);
        setEditStock(product.stock || '');
        setEditDescription(product.description || '');
        if (product.images && Array.isArray(product.images)) {
            setEditImages(product.images);
        } else if (product.image) {
            setEditImages([product.image]);
        } else {
            setEditImages([]);
        }
    };

    const cancelEditing = () => {
        setEditingProduct(null);
        setEditName('');
        setEditDose('');
        setEditBrand('');
        setEditGenericName('');
        setEditBatchNumber('');
        setEditExpiryDate('');
        setEditPrice('');
        setEditStock('');
        setEditDescription('');
        setEditImages([]);
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        setUploading(true);
        try {
            const urls = await Promise.all(files.map(file => uploadToCloudinary(file)));
            setEditImages(prev => [...prev, ...urls]);
        } catch (err) {
            console.error(err);
            alert('Failed to upload images');
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (index) => {
        setEditImages(prev => prev.filter((_, i) => i !== index));
    };

    const saveEdit = async (e) => {
        e.preventDefault();
        if (!editingProduct) return;

        try {
            await updateDoc(doc(db, 'products', editingProduct.id), {
                name: editName,
                dose: editDose,
                brand: editBrand,
                genericName: editGenericName,
                batchNumber: editBatchNumber,
                expiryDate: editExpiryDate,
                price: parseFloat(editPrice),
                stock: editStock ? parseInt(editStock, 10) : 0,
                description: editDescription,
                images: editImages,
                image: editImages.length > 0 ? editImages[0] : null,
            });
            alert('Medicine updated successfully!');
            cancelEditing();
        } catch (err) {
            console.error(err);
            alert('Failed to update medicine');
        }
    };

    return (
        <div>
            <h1>Pharmacy Dashboard</h1>

            {editingProduct ? (
                <div style={{ padding: '20px', border: '1px solid #ccc', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
                    <h2>Edit Medicine</h2>
                    <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
                        <label>
                            Name:
                            <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                        </label>
                        <label>
                            Dose:
                            <input value={editDose} onChange={(e) => setEditDose(e.target.value)} />
                        </label>
                        <label>
                            Brand:
                            <input value={editBrand} onChange={(e) => setEditBrand(e.target.value)} />
                        </label>
                        <label>
                            Generic Name:
                            <input value={editGenericName} onChange={(e) => setEditGenericName(e.target.value)} />
                        </label>
                        <label>
                            Batch Number:
                            <input value={editBatchNumber} onChange={(e) => setEditBatchNumber(e.target.value)} />
                        </label>
                        <label>
                            Expiry Date:
                            <input type="date" value={editExpiryDate} onChange={(e) => setEditExpiryDate(e.target.value)} required />
                        </label>
                        <label>
                            Price:
                            <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} required />
                        </label>
                        <label>
                            Stock:
                            <input type="number" value={editStock} onChange={(e) => setEditStock(e.target.value)} />
                        </label>
                        <label>
                            Description:
                            <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows="3" />
                        </label>
                        <label>
                            Images:
                            <input type="file" accept="image/*" multiple onChange={handleImageUpload} />
                            {uploading && <span>Uploading...</span>}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                                {editImages.map((url, index) => (
                                    <div key={index} style={{ position: 'relative' }}>
                                        <img src={url} alt={`Preview ${index}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px' }} />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            style={{ position: 'absolute', top: -5, right: -5, backgroundColor: 'red', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: 'none', cursor: 'pointer' }}
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={cancelEditing}>Cancel</button>
                            <button type="submit" disabled={uploading}>Save Changes</button>
                        </div>
                    </form>
                </div>
            ) : (
                <>
                    <h2>Add Medicine</h2>
                    <form
                        onSubmit={addMedicine}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            maxWidth: '400px',
                        }}
                    >
                        <label>
                            Medicine Name
                            <input value={name} onChange={(e) => setName(e.target.value)} required />
                        </label>
                        <label>
                            Dose (e.g., 500mg)
                            <input value={dose} onChange={(e) => setDose(e.target.value)} />
                        </label>
                        <label>
                            Brand
                            <input value={brand} onChange={(e) => setBrand(e.target.value)} />
                        </label>
                        <label>
                            Generic Name (for substitutes)
                            <input value={genericName} onChange={(e) => setGenericName(e.target.value)} />
                        </label>
                        <label>
                            Batch Number
                            <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
                        </label>
                        <label>
                            Expiry Date
                            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required />
                        </label>
                        <label>
                            Price
                            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
                        </label>
                        <label>
                            Stock
                            <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
                        </label>

                        <button type="submit">Add Medicine</button>
                    </form>
                </>
            )}

            <h2>Inventory</h2>
            <ul>
                {products.map((p) => (
                    <li key={p.id} style={{ marginBottom: '8px', color: isExpired(p.expiryDate) ? 'red' : 'inherit' }}>
                        <strong>{p.name}</strong> {p.dose} | {p.brand} | ₹{p.price}
                        <br />
                        Generic: {p.genericName} | Batch: {p.batchNumber} | Exp: {p.expiryDate} {isExpired(p.expiryDate) ? '(EXPIRED)' : ''}
                        <br />
                        Stock: {p.stock} | Available: {p.isAvailable ? 'Yes' : 'No'}
                        <button
                            onClick={() => toggleAvailability(p)}
                            style={{ marginLeft: '8px' }}
                        >
                            Toggle availability
                        </button>
                        <button
                            onClick={() => startEditing(p)}
                            style={{ marginLeft: '8px', backgroundColor: '#2196F3', color: 'white' }}
                        >
                            Edit
                        </button>
                    </li>
                ))}
                {products.length === 0 && <p>No medicines added.</p>}
            </ul>

            <h2>Orders</h2>
            <ul>
                {orders.map((o) => {
                    const product = products.find((p) => p.id === o.productId);
                    const customer = customerProfiles[o.customerId];
                    return (
                        <li
                            key={o.id}
                            style={{
                                marginBottom: '8px',
                                padding: '6px',
                                border: '1px solid #ccc',
                            }}
                        >
                            <div>Order ID: {o.id}</div>
                            <div>
                                Medicine: {product ? `${product.name} ${product.dose}` : o.productId}
                            </div>
                            <div>Quantity: {o.quantity}</div>
                            {o.prescriptionUrl && (
                                <div style={{ margin: '5px 0', padding: '5px', background: '#f0f0f0' }}>
                                    <strong>Prescription:</strong>
                                    {o.prescriptionUrl.startsWith('http') ? (
                                        <a href={o.prescriptionUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '5px' }}>
                                            View File
                                        </a>
                                    ) : (
                                        <span style={{ marginLeft: '5px' }}>{o.prescriptionUrl}</span>
                                    )}
                                </div>
                            )}
                            <div>
                                Customer: {customer ? customer.name : o.customerId}
                                {customer?.phone && ` (Phone: ${customer.phone})`}
                            </div>
                            <div>Status: <strong>{o.status}</strong></div>

                            <div style={{ marginTop: '4px' }}>
                                {o.status === 'pending_prescription_review' && (
                                    <>
                                        <button onClick={() => updateOrderStatus(o, 'accepted')}>
                                            Approve & Accept
                                        </button>
                                        <div style={{ marginTop: '5px' }}>
                                            <input
                                                placeholder="Rejection Reason"
                                                value={rejectionReason[o.id] || ''}
                                                onChange={(e) => handleRejectionReasonChange(o.id, e.target.value)}
                                            />
                                            <button
                                                onClick={() => updateOrderStatus(o, 'rejected', rejectionReason[o.id] || 'Prescription invalid')}
                                                style={{ marginLeft: '5px' }}
                                            >
                                                Reject
                                            </button>
                                        </div>

                                        <div style={{ marginTop: '10px', padding: '5px', border: '1px dashed #999' }}>
                                            <strong>Or Forward to Doctor:</strong>
                                            <br />
                                            <select
                                                value={selectedDoctor[o.id] || ''}
                                                onChange={(e) => setSelectedDoctor(prev => ({ ...prev, [o.id]: e.target.value }))}
                                                style={{ marginRight: '5px' }}
                                            >
                                                <option value="">-- Select Doctor --</option>
                                                {doctors.map(d => (
                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                ))}
                                            </select>
                                            <button onClick={() => forwardToDoctor(o)}>Forward</button>
                                        </div>
                                    </>
                                )}

                                {o.status === 'pending_doctor_approval' && (
                                    <div style={{ color: 'orange', fontWeight: 'bold' }}>
                                        Waiting for Doctor Approval...
                                    </div>
                                )}

                                {o.status === 'accepted' && (
                                    <button onClick={() => updateOrderStatus(o, 'ready_for_delivery')}>
                                        Mark ready for delivery
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
                {orders.length === 0 && <p>No orders yet.</p>}
            </ul>
        </div>
    );
};

export default PharmacyDashboard;
