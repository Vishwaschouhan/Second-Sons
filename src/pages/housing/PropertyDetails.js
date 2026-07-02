import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    doc,
    getDoc,
    collection,
    addDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';

const PropertyDetails = () => {
    const { propertyId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [property, setProperty] = useState(null);
    const [host, setHost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [, setError] = useState('');
    const [selectedImage, setSelectedImage] = useState('');

    // Booking State
    const [stayType, setStayType] = useState('DAY');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [bookingMessage, setBookingMessage] = useState('');

    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const docRef = doc(db, 'properties', propertyId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const pData = { id: docSnap.id, ...docSnap.data() };
                    setProperty(pData);

                    if (pData.images && pData.images.length > 0) {
                        setSelectedImage(pData.images[0]);
                    } else if (pData.imageUrl) {
                        setSelectedImage(pData.imageUrl);
                    }

                    // Fetch Host
                    if (pData.hostId) {
                        const hostSnap = await getDoc(doc(db, 'users', pData.hostId));
                        if (hostSnap.exists()) {
                            setHost(hostSnap.data());
                        }
                    }
                } else {
                    setError('Property not found');
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load property');
            } finally {
                setLoading(false);
            }
        };

        fetchProperty();
    }, [propertyId]);

    const bookProperty = async (e) => {
        e.preventDefault();
        if (!user) {
            alert('Please login to book');
            return;
        }
        if (!startDate) return;

        try {
            await addDoc(collection(db, 'bookings'), {
                propertyId: property.id,
                hostId: property.hostId,
                customerId: user.uid,
                stayType,
                startDate,
                endDate: stayType === 'DAY' ? endDate || startDate : endDate || null,
                status: 'pending',
                createdAt: serverTimestamp(),
            });
            setBookingMessage('Booking request sent successfully!');
            setStartDate('');
            setEndDate('');
        } catch (err) {
            console.error(err);
            alert('Failed to book property');
        }
    };

    if (loading) return <div>Loading...</div>;
    if (!property) return <div>Property not found</div>;

    return (
        <div style={{ padding: '20px' }}>
            <button onClick={() => navigate(-1)} style={{ marginBottom: '20px' }}>
                &larr; Back
            </button>

            <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <h1>{property.title}</h1>

                    {/* Image Gallery */}
                    <div style={{ marginBottom: '20px' }}>
                        {selectedImage && (
                            <img
                                src={selectedImage}
                                alt={property.title}
                                style={{ width: '100%', maxWidth: '600px', height: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }}
                            />
                        )}
                        {property.images && property.images.length > 1 && (
                            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
                                {property.images.map((img, idx) => (
                                    <img
                                        key={idx}
                                        src={img}
                                        alt={`Thumbnail ${idx}`}
                                        onClick={() => setSelectedImage(img)}
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            objectFit: 'cover',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            border: selectedImage === img ? '2px solid #2196F3' : '1px solid #ccc'
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <h3>Details</h3>
                        <p><strong>Type:</strong> {property.propertyType}</p>
                        <p><strong>Address:</strong> {property.address}</p>
                        <p>{property.description}</p>

                        {property.facilities && property.facilities.length > 0 && (
                            <p><strong>Facilities:</strong> {property.facilities.join(', ')}</p>
                        )}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <h3>Pricing</h3>
                        {property.pricePerDay && <p><strong>Daily:</strong> ₹{property.pricePerDay}/day</p>}
                        {property.pricePerMonth && <p><strong>Monthly:</strong> ₹{property.pricePerMonth}/month</p>}
                    </div>

                    {host && (
                        <div style={{ padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                            <h4>Host Information</h4>
                            <p><strong>Name:</strong> {host.name}</p>
                            {host.phone && <p><strong>Phone:</strong> {host.phone}</p>}
                        </div>
                    )}
                </div>

                <div style={{ flex: 1, minWidth: '300px', maxWidth: '400px' }}>
                    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', position: 'sticky', top: '20px' }}>
                        <h2>Book this Property</h2>
                        <form onSubmit={bookProperty} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <label>
                                Stay Type:
                                <select
                                    value={stayType}
                                    onChange={(e) => setStayType(e.target.value)}
                                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                                >
                                    <option value="DAY">Short Term (Daily)</option>
                                    <option value="LONG_TERM">Long Term (Monthly)</option>
                                </select>
                            </label>

                            <label>
                                Start Date:
                                <input
                                    type="date"
                                    value={startDate}
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={(e) => {
                                        const newStart = e.target.value;
                                        setStartDate(newStart);
                                        if (endDate && newStart > endDate) {
                                            setEndDate('');
                                        }
                                    }}
                                    required
                                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                                />
                            </label>

                            {stayType === 'DAY' && (
                                <label>
                                    End Date:
                                    <input
                                        type="date"
                                        value={endDate}
                                        min={startDate || new Date().toISOString().split('T')[0]}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                                    />
                                </label>
                            )}

                            <button
                                type="submit"
                                style={{
                                    padding: '12px',
                                    backgroundColor: '#2196F3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    fontSize: '16px'
                                }}
                            >
                                Send Booking Request
                            </button>
                        </form>
                        {bookingMessage && <p style={{ color: 'green', marginTop: '15px', textAlign: 'center' }}>{bookingMessage}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PropertyDetails;
