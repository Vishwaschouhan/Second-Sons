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



const ShopDashboard = () => {
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customerProfiles, setCustomerProfiles] = useState({});

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

  const createProduct = async (e) => {
    e.preventDefault();
    if (!name || !category || !price) return;

    await addDoc(collection(db, 'products'), {
      shopId: user.uid,
      name,
      category,
      price: parseFloat(price),
      stock: stock ? parseInt(stock, 10) : null,
      isAvailable: true,
      createdAt: serverTimestamp(),
    });

    setName('');
    setCategory('');
    setPrice('');
    setStock('');
  };

  const toggleAvailability = async (product) => {
    await updateDoc(doc(db, 'products', product.id), {
      isAvailable: !product.isAvailable,
    });
  };

  const updateOrderStatus = async (order, status) => {
    await updateDoc(doc(db, 'commerceOrders', order.id), {
      status,
    });
  };

  const [editingProduct, setEditingProduct] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImages, setEditImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const startEditing = (product) => {
    setEditingProduct(product);
    setEditName(product.name);
    setEditCategory(product.category);
    setEditPrice(product.price);
    setEditStock(product.stock || '');
    setEditDescription(product.description || '');
    // Handle legacy single image or new array
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
    setEditCategory('');
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
        category: editCategory,
        price: parseFloat(editPrice),
        stock: editStock ? parseInt(editStock, 10) : null,
        description: editDescription,
        images: editImages,
        image: editImages.length > 0 ? editImages[0] : null, // Legacy support
      });
      alert('Product updated successfully!');
      cancelEditing();
    } catch (err) {
      console.error(err);
      alert('Failed to update product');
    }
  };

  return (
    <div>
      <h1>Quick Commerce (Shop)</h1>

      {editingProduct ? (
        <div style={{ padding: '20px', border: '1px solid #ccc', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
          <h2>Edit Product</h2>
          <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
            <label>
              Name:
              <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </label>
            <label>
              Category:
              <input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} required />
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
          <h2>Add product</h2>
          <form
            onSubmit={createProduct}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxWidth: '400px',
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
              Category
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              />
            </label>

            <label>
              Price
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </label>

            <label>
              Stock (optional)
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </label>

            <button type="submit">Add product</button>
          </form>
        </>
      )}

      <h2>Your products</h2>
      <ul>
        {products.map((p) => (
          <li key={p.id} style={{ marginBottom: '8px' }}>
            {p.name} ({p.category}) | ₹{p.price}{' '}
            {p.stock != null && <span>| Stock: {p.stock}</span>}{' '}
            | Available: {p.isAvailable ? 'Yes' : 'No'}
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
        {products.length === 0 && <p>No products yet.</p>}
      </ul>

      <h2>Orders to fulfill</h2>
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
                Product:{' '}
                {product ? product.name : o.productId}
              </div>
              <div>Quantity: {o.quantity}</div>
              <div>
                Customer:{' '}
                {customer ? customer.name : o.customerId}
                {customer?.phone &&
                  ` (Phone: ${customer.phone})`}
              </div>
              <div>Address: {o.address}</div>
              <div>Status: {o.status}</div>
              <div style={{ marginTop: '4px' }}>
                {o.status === 'pending' && (
                  <>
                    <button
                      onClick={() =>
                        updateOrderStatus(o, 'accepted')
                      }
                    >
                      Accept
                    </button>
                    <button
                      onClick={() =>
                        updateOrderStatus(o, 'rejected')
                      }
                      style={{ marginLeft: '8px' }}
                    >
                      Reject
                    </button>
                  </>
                )}
                {o.status === 'accepted' && (
                  <button
                    onClick={() =>
                      updateOrderStatus(
                        o,
                        'ready_for_delivery'
                      )
                    }
                  >
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

export default ShopDashboard;
