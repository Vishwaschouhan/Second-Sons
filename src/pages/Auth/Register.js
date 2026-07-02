import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { ROLE_OPTIONS } from '../../roles';
import { SERVICE_CATEGORIES } from '../../serviceCategories';

const Register = () => {
  // Force recompile
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [role, setRole] = useState('CUSTOMER');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [expertiseCategory, setExpertiseCategory] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      const baseProfile = {
        name,
        email,
        role,
        phone,
        address,
        createdAt: serverTimestamp(),
      };

      const extraFields =
        role === 'WORKER'
          ? { expertiseCategory: expertiseCategory }
          : { expertiseCategory: '' };

      await setDoc(doc(db, 'users', uid), {
        ...baseProfile,
        ...extraFields,
      });

      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to register');
    }
  };

  return (
    <div>
      <h1>Register</h1>
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
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
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

        {role === 'WORKER' && (
          <label>
            Expertise category
            <select
              value={expertiseCategory}
              onChange={(e) => setExpertiseCategory(e.target.value)}
              required
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

        <label>
          Password
          <input
            type="password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button type="submit">Create account</button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
};

export default Register;
