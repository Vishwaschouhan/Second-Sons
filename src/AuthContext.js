import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          const userRef = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userRef);

          if (snap.exists()) {
            setProfile({ id: snap.id, ...snap.data() });
          } else {
            const email = firebaseUser.email || '';
            const defaultName =
              firebaseUser.displayName || email.split('@')[0] || 'User';

            const defaultProfile = {
              name: defaultName,
              email,
              role: 'CUSTOMER',
              phone: '',
              address: '',
              expertiseCategory: '',
              createdAt: serverTimestamp(),
            };

            await setDoc(userRef, defaultProfile);
            setProfile({ id: firebaseUser.uid, ...defaultProfile });
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('Error loading user profile:', err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const logout = () => signOut(auth);

  const refreshProfile = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const userRef = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setProfile({ id: snap.id, ...snap.data() });
      }
    } catch (err) {
      console.error('Failed to refresh profile', err);
    }
  };

  const value = { user, profile, loading, logout, refreshProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
