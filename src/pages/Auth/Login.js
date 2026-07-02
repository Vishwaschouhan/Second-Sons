import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to login');
    }
  };

  return (
    <div>
      <h1>Login</h1>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px' }}>
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
          Password
          <input
            type="password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button type="submit">Login</button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <p>
        Don&apos;t have an account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
};

export default Login;
