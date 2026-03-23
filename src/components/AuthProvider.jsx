/**
 * AuthProvider.jsx
 *
 * Clean separation of concerns:
 * 1. Auth state (session/user) — driven by onAuthStateChange only
 * 2. Profile + subscription — loaded in a separate useEffect watching userId
 *
 * This avoids the "Lock broken by another request" AbortError caused by
 * making DB queries inside the auth state change callback.
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session,      setSession]      = useState(undefined); // undefined = not yet checked
  const [user,         setUser]         = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const mountedRef = useRef(true);

  // ── Step 1: Track auth session ─────────────────────────────────────────────
  // ONLY sets session/user state. Does NOT make any DB calls.
  useEffect(() => {
    mountedRef.current = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mountedRef.current) return;
      setSession(s);
      setUser(s?.user ?? null);
    }).catch(() => {
      if (mountedRef.current) {
        setSession(null);
        setUser(null);
      }
    });

    // Listen for changes — token refresh, sign in, sign out
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mountedRef.current) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    );

    return () => {
      mountedRef.current = false;
      authSub.unsubscribe();
    };
  }, []);

  // ── Step 2: Load profile + subscription when userId changes ───────────────
  // Runs AFTER auth settles — no lock contention because we're not inside the
  // auth callback. Uses a separate async flow with its own abort handling.
  useEffect(() => {
    // session === undefined means we haven't heard from auth yet — wait
    if (session === undefined) return;

    // Signed out
    if (!user?.id) {
      setProfile(null);
      setSubscription(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      // Small delay to ensure the auth token is fully committed to storage
      await new Promise(r => setTimeout(r, 150));
      if (cancelled) return;

      try {
        // Load profile
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select(`
            id,
            user_id,
            organization_id,
            role,
            full_name,
            email,
            is_active,
            organizations(name, trial_ends_at, subscription_status, subscription_tier)
          `)
          .eq('user_id', user.id)
          .single();

        if (cancelled) return;

        if (profileErr) {
          console.error('[AuthProvider] profile load error:', profileErr.message);
          // Retry once after a short delay
          await new Promise(r => setTimeout(r, 800));
          if (cancelled) return;
          const { data: retry } = await supabase
            .from('profiles')
            .select(`id, user_id, organization_id, role, full_name, email, is_active, organizations(name, trial_ends_at, subscription_status, subscription_tier)`)
            .eq('user_id', user.id)
            .single();
          if (cancelled) return;
          if (retry?.organizations) retry.organization = retry.organizations;
          setProfile(retry ?? null);
          if (retry?.organization_id) {
            const { data: sub } = await supabase
              .from('subscriptions').select('*').eq('organization_id', retry.organization_id).single();
            if (!cancelled) setSubscription(sub ?? null);
          }
        } else {
          if (profileData?.organizations) profileData.organization = profileData.organizations;
          setProfile(profileData ?? null);
          if (profileData?.organization_id) {
            const { data: sub } = await supabase
              .from('subscriptions').select('*').eq('organization_id', profileData.organization_id).single();
            if (!cancelled) setSubscription(sub ?? null);
          }
        }
      } catch (e) {
        if (!cancelled) console.error('[AuthProvider] loadData error:', e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    loadData();

    return () => { cancelled = true; };
  }, [user?.id, session]);  // re-run when user changes

  async function signOut() {
    await supabase.auth.signOut();
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
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
