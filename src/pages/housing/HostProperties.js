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


const uploadImageToCloudinary = async (file) => {
  const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary config missing');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || 'Cloudinary upload failed');
  }
  return data.secure_url;
};



const HostProperties = () => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState('BOTH');
  const [pricePerDay, setPricePerDay] = useState('');
  const [pricePerMonth, setPricePerMonth] = useState('');
  const [facilities, setFacilities] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [properties, setProperties] = useState([]);
  const [hostBookings, setHostBookings] = useState([]);
  const [customerProfiles, setCustomerProfiles] = useState({});
  const [error, setError] = useState('');

  // Editing state
  const [editingProperty, setEditingProperty] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPropertyType, setEditPropertyType] = useState('BOTH');
  const [editPricePerDay, setEditPricePerDay] = useState('');
  const [editPricePerMonth, setEditPricePerMonth] = useState('');
  const [editFacilities, setEditFacilities] = useState('');
  const [editImages, setEditImages] = useState([]);

  useEffect(() => {
    if (!user) return;
    const qProps = query(
      collection(db, 'properties'),
      where('hostId', '==', user.uid)
    );
    const unsubProps = onSnapshot(qProps, (snapshot) => {
      setProperties(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const qBookings = query(
      collection(db, 'bookings'),
      where('hostId', '==', user.uid)
    );
    const unsubBookings = onSnapshot(qBookings, (snapshot) => {
      setHostBookings(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    });

    return () => {
      unsubProps();
      unsubBookings();
    };
  }, [user]);

  useEffect(() => {
    const loadCustomers = async () => {
      const ids = Array.from(
        new Set(
          hostBookings
            .map((b) => b.customerId)
            .filter(Boolean)
        )
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

    if (hostBookings.length > 0) {
      loadCustomers();
    } else {
      setCustomerProfiles({});
    }
  }, [hostBookings]);

  const handleImageUpload = async (e, isEdit = false) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(file => uploadImageToCloudinary(file)));
      if (isEdit) {
        setEditImages(prev => [...prev, ...urls]);
      } else {
        setImages(prev => [...prev, ...urls]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index, isEdit = false) => {
    if (isEdit) {
      setEditImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const facilitiesArr = facilities
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

      await addDoc(collection(db, 'properties'), {
        hostId: user.uid,
        title,
        address,
        description,
        propertyType,
        pricePerDay: pricePerDay ? parseFloat(pricePerDay) : null,
        pricePerMonth: pricePerMonth ? parseFloat(pricePerMonth) : null,
        facilities: facilitiesArr,
        images,
        imageUrl: images.length > 0 ? images[0] : null, // Legacy support
        isActive: true,
        createdAt: serverTimestamp(),
      });

      setTitle('');
      setAddress('');
      setDescription('');
      setPropertyType('BOTH');
      setPricePerDay('');
      setPricePerMonth('');
      setFacilities('');
      setImages([]);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create property');
    }
  };

  const startEditing = (property) => {
    setEditingProperty(property);
    setEditTitle(property.title);
    setEditAddress(property.address);
    setEditDescription(property.description);
    setEditPropertyType(property.propertyType);
    setEditPricePerDay(property.pricePerDay || '');
    setEditPricePerMonth(property.pricePerMonth || '');
    setEditFacilities(property.facilities ? property.facilities.join(', ') : '');

    if (property.images && Array.isArray(property.images)) {
      setEditImages(property.images);
    } else if (property.imageUrl) {
      setEditImages([property.imageUrl]);
    } else {
      setEditImages([]);
    }
  };

  const cancelEditing = () => {
    setEditingProperty(null);
    setEditTitle('');
    setEditAddress('');
    setEditDescription('');
    setEditPropertyType('BOTH');
    setEditPricePerDay('');
    setEditPricePerMonth('');
    setEditFacilities('');
    setEditImages([]);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editingProperty) return;

    try {
      const facilitiesArr = editFacilities
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

      await updateDoc(doc(db, 'properties', editingProperty.id), {
        title: editTitle,
        address: editAddress,
        description: editDescription,
        propertyType: editPropertyType,
        pricePerDay: editPricePerDay ? parseFloat(editPricePerDay) : null,
        pricePerMonth: editPricePerMonth ? parseFloat(editPricePerMonth) : null,
        facilities: facilitiesArr,
        images: editImages,
        imageUrl: editImages.length > 0 ? editImages[0] : null,
      });
      alert('Property updated successfully!');
      cancelEditing();
    } catch (err) {
      console.error(err);
      alert('Failed to update property');
    }
  };

  const toggleActive = async (property) => {
    await updateDoc(doc(db, 'properties', property.id), {
      isActive: !property.isActive,
    });
  };

  const confirmBooking = async (booking) => {
    if (booking.status !== 'pending') return;
    await updateDoc(doc(db, 'bookings', booking.id), {
      status: 'confirmed',
    });
  };

  const cancelBooking = async (booking) => {
    if (booking.status === 'cancelled') return;
    await updateDoc(doc(db, 'bookings', booking.id), {
      status: 'cancelled',
    });
  };

  return (
    <div>
      <h1>Host Properties</h1>

      {editingProperty ? (
        <div style={{ padding: '20px', border: '1px solid #ccc', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
          <h2>Edit Property</h2>
          <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '500px' }}>
            <label>
              Title:
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            </label>
            <label>
              Address:
              <textarea value={editAddress} onChange={(e) => setEditAddress(e.target.value)} required />
            </label>
            <label>
              Description:
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} required />
            </label>
            <label>
              Property type:
              <select value={editPropertyType} onChange={(e) => setEditPropertyType(e.target.value)}>
                <option value="SHORT_TERM">Short term (like hotel)</option>
                <option value="LONG_TERM">Long term (rental)</option>
                <option value="BOTH">Both</option>
              </select>
            </label>
            <label>
              Price per day:
              <input type="number" value={editPricePerDay} onChange={(e) => setEditPricePerDay(e.target.value)} />
            </label>
            <label>
              Price per month:
              <input type="number" value={editPricePerMonth} onChange={(e) => setEditPricePerMonth(e.target.value)} />
            </label>
            <label>
              Facilities (comma separated):
              <input value={editFacilities} onChange={(e) => setEditFacilities(e.target.value)} />
            </label>
            <label>
              Images:
              <input type="file" accept="image/*" multiple onChange={(e) => handleImageUpload(e, true)} />
              {uploading && <span>Uploading...</span>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                {editImages.map((url, index) => (
                  <div key={index} style={{ position: 'relative' }}>
                    <img src={url} alt={`Preview ${index}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px' }} />
                    <button
                      type="button"
                      onClick={() => removeImage(index, true)}
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
          <h2>Add Property</h2>
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxWidth: '500px',
            }}
          >
            <label>
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>

            <label>
              Address
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </label>

            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </label>

            <label>
              Property type
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
              >
                <option value="SHORT_TERM">Short term (like hotel)</option>
                <option value="LONG_TERM">Long term (rental)</option>
                <option value="BOTH">Both</option>
              </select>
            </label>

            <label>
              Price per day (for short term)
              <input
                type="number"
                value={pricePerDay}
                onChange={(e) => setPricePerDay(e.target.value)}
              />
            </label>

            <label>
              Price per month (for long term)
              <input
                type="number"
                value={pricePerMonth}
                onChange={(e) => setPricePerMonth(e.target.value)}
              />
            </label>

            <label>
              Facilities (comma separated)
              <input
                value={facilities}
                onChange={(e) => setFacilities(e.target.value)}
              />
            </label>

            <label>
              Images
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleImageUpload(e, false)}
              />
              {uploading && <span>Uploading...</span>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                {images.map((url, index) => (
                  <div key={index} style={{ position: 'relative' }}>
                    <img src={url} alt={`Preview ${index}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px' }} />
                    <button
                      type="button"
                      onClick={() => removeImage(index, false)}
                      style={{ position: 'absolute', top: -5, right: -5, backgroundColor: 'red', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: 'none', cursor: 'pointer' }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </label>

            <button type="submit" disabled={uploading}>
              Create property
            </button>
          </form>
        </>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h2>Your properties</h2>
      <ul>
        {properties.map((p) => (
          <li
            key={p.id}
            style={{
              marginBottom: '10px',
              padding: '8px',
              border: '1px solid #ccc',
            }}
          >
            <strong>{p.title}</strong> ({p.propertyType}) | Active:{' '}
            {p.isActive ? 'Yes' : 'No'}
            <div>{p.address}</div>
            {p.imageUrl && (
              <img
                src={p.imageUrl}
                alt={p.title}
                style={{
                  maxWidth: '200px',
                  display: 'block',
                  marginTop: '4px',
                }}
              />
            )}
            <div style={{ marginTop: '10px' }}>
              <button
                onClick={() => toggleActive(p)}
                style={{ marginRight: '8px' }}
              >
                Toggle active
              </button>
              <button
                onClick={() => startEditing(p)}
                style={{ backgroundColor: '#2196F3', color: 'white' }}
              >
                Edit
              </button>
            </div>
          </li>
        ))}
        {properties.length === 0 && <p>No properties yet.</p>}
      </ul>

      <h2>Bookings for your properties</h2>
      <ul>
        {hostBookings.map((b) => {
          const prop = properties.find((p) => p.id === b.propertyId);
          const customer = customerProfiles[b.customerId];
          return (
            <li
              key={b.id}
              style={{
                marginBottom: '8px',
                padding: '6px',
                border: '1px solid #ccc',
              }}
            >
              <div>
                Property:{' '}
                {prop ? prop.title : b.propertyId}
              </div>
              <div>
                Stay type: {b.stayType} | {b.startDate}
                {b.endDate && b.endDate !== b.startDate && ` → ${b.endDate}`}
              </div>
              <div>Status: {b.status}</div>
              {customer && (
                <div>
                  Customer: {customer.name}
                  {customer.phone &&
                    ` (Phone: ${customer.phone})`}
                </div>
              )}
              {b.status === 'pending' && (
                <>
                  <button onClick={() => confirmBooking(b)}>
                    Confirm booking
                  </button>
                  <button
                    onClick={() => cancelBooking(b)}
                    style={{ marginLeft: '8px' }}
                  >
                    Cancel
                  </button>
                </>
              )}
              {b.status === 'confirmed' && (
                <button onClick={() => cancelBooking(b)}>
                  Cancel booking
                </button>
              )}
            </li>
          );
        })}
        {hostBookings.length === 0 && (
          <p>No bookings for your properties yet.</p>
        )}
      </ul>
    </div>
  );
};

export default HostProperties;
