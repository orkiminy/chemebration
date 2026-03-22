import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const snap = await getDoc(doc(db, "students", currentUser.uid));
          // Only true when explicitly set to false (new signup) — missing field = existing user
          setIsFirstTime(snap.exists() && snap.data()?.hasSeenTutorial === false);
        } catch {
          setIsFirstTime(false);
        }
      } else {
        setIsFirstTime(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logout = () => signOut(auth);

  const markTutorialSeen = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "students", user.uid), { hasSeenTutorial: true });
      setIsFirstTime(false);
    } catch (e) {
      console.error("Failed to mark tutorial seen", e);
    }
  };

  const value = { user, loading, isFirstTime, markTutorialSeen, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
