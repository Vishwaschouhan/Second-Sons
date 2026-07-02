import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc,
    getDocs,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';

const ProductDetails = () => {
    const { productId } = useParams();
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const [product, setProduct] = useState(null);
    const [shop, setShop] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [qty, setQty] = useState(1);
    const [specialRequest, setSpecialRequest] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [selectedImage, setSelectedImage] = useState('');

    // Buy Now State
    const [buyNowModalOpen, setBuyNowModalOpen] = useState(false);
    const [buyNowQty, setBuyNowQty] = useState(1);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const docRef = doc(db, 'products', productId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const pData = { id: docSnap.id, ...docSnap.data() };
                    setProduct(pData);
                    if (pData.images && pData.images.length > 0) {
                        setSelectedImage(pData.images[0]);
                    } else if (pData.image) {
                        setSelectedImage(pData.image);
                    }

                    // Fetch Shop
                    if (pData.shopId) {
                        const shopSnap = await getDoc(doc(db, 'users', pData.shopId));
                        if (shopSnap.exists()) {
                            setShop(shopSnap.data());
                        }
                    }
                } else {
                    setError('Product not found');
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load product');
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();

        // Fetch Reviews
        const qReviews = query(
            collection(db, 'productReviews'),
            where('productId', '==', productId)
        );
        const unsubReviews = onSnapshot(qReviews, (snapshot) => {
            setReviews(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });

        return () => unsubReviews();
    }, [productId]);

    const addToCart = async () => {
        if (!user) {
            alert('Please login to add to cart');
            return;
        }
        if (!profile.address) {
            alert('Please set your address in profile first');
            return;
        }
        if (product.expiryDate && new Date(product.expiryDate) < new Date()) {
            alert('Cannot order expired item');
            return;
        }

        try {
            let existingItem = null;
            if (!specialRequest) {
                const q = query(
                    collection(db, 'cartItems'),
                    where('userId', '==', user.uid),
                    where('productId', '==', product.id)
                );
                const snap = await getDocs(q);
                existingItem = snap.docs.find((d) => !d.data().specialRequest);
            }

            if (!existingItem) {
                await addDoc(collection(db, 'cartItems'), {
                    userId: user.uid,
                    shopId: product.shopId,
                    productId: product.id,
                    quantity: parseInt(qty, 10),
                    specialRequest: specialRequest || null,
                    createdAt: serverTimestamp(),
                });
            } else {
                const currentQty = existingItem.data().quantity || 1;
                await updateDoc(existingItem.ref, {
                    quantity: currentQty + parseInt(qty, 10),
                });
            }
            setMessage('Added to cart!');
        } catch (err) {
            console.error(err);
            setError('Failed to add to cart');
        }
    };

    const openBuyNow = () => {
        if (!user) {
            alert('Please login to buy');
            return;
        }
        if (!profile.address) {
            alert('Please set your address in profile first');
            return;
        }
        if (product.expiryDate && new Date(product.expiryDate) < new Date()) {
            alert('Cannot order expired item');
            return;
        }
        setBuyNowQty(1);
        setBuyNowModalOpen(true);
    };

    const confirmBuyNow = async () => {
        try {
            await addDoc(collection(db, 'commerceOrders'), {
                customerId: user.uid,
                shopId: product.shopId,
                productId: product.id,
                quantity: parseInt(buyNowQty, 10),
                specialRequest: specialRequest || null,
                prescriptionUrl: null,
                status: 'pending',
                isRepeatable: false,
                repeatFrequency: null,
                deliveryPartnerId: null,
                address: profile.address,
                createdAt: serverTimestamp(),
            });
            alert('Order placed successfully!');
            setBuyNowModalOpen(false);
            navigate('/orders');
        } catch (err) {
            console.error(err);
            alert('Failed to place order');
        }
    };

    if (loading) return <div>Loading...</div>;
    if (!product) return <div>Product not found</div>;

    const averageRating =
        reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
            : 'No ratings yet';

    return (
        <div style={{ padding: '20px' }}>
            <button onClick={() => navigate(-1)} style={{ marginBottom: '20px' }}>
                &larr; Back
            </button>

            <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <h1>{product.name}</h1>

                    {/* Image Gallery */}
                    <div style={{ marginBottom: '20px' }}>
                        {selectedImage && (
                            <img
                                src={selectedImage}
                                alt={product.name}
                                style={{ width: '100%', maxWidth: '400px', height: '300px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }}
                            />
                        )}
                        {product.images && product.images.length > 1 && (
                            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
                                {product.images.map((img, idx) => (
                                    <img
                                        key={idx}
                                        src={img}
                                        alt={`Thumbnail ${idx}`}
                                        onClick={() => setSelectedImage(img)}
                                        style={{
                                            width: '60px',
                                            height: '60px',
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
                    {shop && <p>Sold by: <strong>{shop.name}</strong> ({shop.role})</p>}
                    <h2 style={{ color: '#2E7D32' }}>₹{product.price}</h2>

                    <div style={{ margin: '10px 0', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '5px' }}>
                        <p><strong>Rating:</strong> {averageRating} ⭐ ({reviews.length} reviews)</p>
                    </div>

                    <p>{product.description || 'No description available.'}</p>

                    {product.dose && <p><strong>Dose:</strong> {product.dose}</p>}
                    {product.brand && <p><strong>Brand:</strong> {product.brand}</p>}
                    {product.genericName && <p><strong>Generic Name:</strong> {product.genericName}</p>}

                    {product.isVeg !== undefined && (
                        <p style={{ color: product.isVeg ? 'green' : 'red', fontWeight: 'bold' }}>
                            {product.isVeg ? '● Veg' : '● Non-Veg'}
                        </p>
                    )}

                    <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #eee', borderRadius: '8px' }}>
                        <label style={{ display: 'block', marginBottom: '10px' }}>
                            Quantity:
                            <input
                                type="number"
                                min="1"
                                value={qty}
                                onChange={(e) => setQty(e.target.value)}
                                style={{ marginLeft: '10px', width: '60px', padding: '5px' }}
                            />
                        </label>

                        {shop?.role === 'RESTAURANT' && (
                            <label style={{ display: 'block', marginBottom: '10px' }}>
                                Special Request:
                                <input
                                    type="text"
                                    value={specialRequest}
                                    onChange={(e) => setSpecialRequest(e.target.value)}
                                    placeholder="e.g., no onion"
                                    style={{ marginLeft: '10px', width: '200px', padding: '5px' }}
                                />
                            </label>
                        )}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                            <button
                                onClick={addToCart}
                                style={{ padding: '10px 20px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                            >
                                Add to Cart
                            </button>
                            {shop?.role !== 'PHARMACY' && (
                                <button
                                    onClick={openBuyNow}
                                    style={{ padding: '10px 20px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                                >
                                    Buy Now
                                </button>
                            )}
                        </div>
                        {message && <p style={{ color: 'green', marginTop: '10px' }}>{message}</p>}
                        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
                    </div>
                </div>

                <div style={{ flex: 1, minWidth: '300px' }}>
                    <h3>Reviews & Ratings</h3>
                    {reviews.length === 0 ? (
                        <p>No reviews yet.</p>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {reviews.map((r) => (
                                <li key={r.id} style={{ marginBottom: '15px', padding: '10px', borderBottom: '1px solid #eee' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <strong>{r.rating} ⭐</strong>
                                        <small style={{ color: '#666' }}>{r.createdAt?.toDate().toLocaleDateString()}</small>
                                    </div>
                                    <p style={{ marginTop: '5px' }}>{r.reviewText}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Buy Now Modal */}
            {buyNowModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '300px' }}>
                        <h3>Buy Now: {product.name}</h3>
                        <p>Price: ₹{product.price}</p>
                        <label>
                            Quantity:
                            <input
                                type="number"
                                min="1"
                                value={buyNowQty}
                                onChange={(e) => setBuyNowQty(e.target.value)}
                                style={{ width: '100%', marginTop: '5px', marginBottom: '15px', padding: '5px' }}
                            />
                        </label>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setBuyNowModalOpen(false)}>Cancel</button>
                            <button onClick={confirmBuyNow} style={{ backgroundColor: '#FF9800', color: 'white' }}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductDetails;
