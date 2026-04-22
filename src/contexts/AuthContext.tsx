import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type UserRole = 'master_admin' | 'admin' | 'production' | 'client';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch or create user document
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          setUser({ uid: firebaseUser.uid, ...userDoc.data() } as AppUser);
        } else {
          // Initialize new user
          const isMasterAdmin = firebaseUser.email === 'rabbani.metamorfashion@gmail.com';
          const newUserData = {
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'Unnamed User',
            role: isMasterAdmin ? 'master_admin' : 'client',
            createdAt: Date.now(),
          };

          try {
            await setDoc(userDocRef, newUserData);
            setUser({ uid: firebaseUser.uid, ...newUserData } as AppUser);
          } catch (error) {
            console.error("Error creating user profile:", error);
            // Even if creating fails due to rules, try to set user as basic
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
