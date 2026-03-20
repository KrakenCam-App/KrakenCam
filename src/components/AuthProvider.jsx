/**
 * AuthProvider.jsx
 * 
 * Supabase auth context. Wrap your app in this to provide:
 * - session (Supabase session object)
 * - user (Supabase user object)
 * - profile (KrakenCam profile with role + org info)
 * - subscription (current org subscription)
 * - loading (true while auth is initializing)
 * - signOut()
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]       = useState(null);
  const [user, setUser]             = useState(null);
  const [profile, setProfile]       = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading]       = useState(true);

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        organization_id,
        role,
        full_name,
        email,
        is_active
      `)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[AuthProvider] Failed to load profile:', error);
      return null;
    }
    return data;
  }

  async function loadSubscription(orgId) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', orgId)
      .single();

    if (error) {
      console.error('[AuthProvider] Failed to load subscription:', error);
      return null;
    }
    return data;
  }

  async function hydrateUser(session) {
    if (!session?.user) {
      setUser(null);
      setProfile(null);
      setSubscription(null);
      return;
    }

    setUser(session.user);

    const profileData = await loadProfile(session.user.id);
    setProfile(profileData);

    if (profileData?.organization_id) {
      const subData = await loadSubscription(profileData.organization_id);
      setSubscription(subData);
    }
  }

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      hydrateUser(session).finally(() => setLoading(false));
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        await hydrateUser(newSession);
        setLoading(false);
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setSubscription(null);
  }

  const value = {
    session,
    user,
    profile,
    subscription,
    loading,
    signOut,
    isAdmin: profile?.role === 'admin',
    orgId:   profile?.organization_id,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
