/**
 * ProtectedRoute.jsx
 *
 * Guards routes that require authentication and an active/trialing subscription.
 *
 * Usage:
 *   <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
 *   <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>} />
 *
 * Redirect logic:
 * - Not logged in → /login
 * - Logged in but subscription cancelled/expired → /billing?status=cancelled
 * - Logged in but admin required and user is not admin → /dashboard (403)
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { session, profile, subscription, loading } = useAuth();
  const location = useLocation();

  // While auth is initializing, show a loading screen
  if (loading) {
    return (
      <div className="loading-screen" aria-label="Loading...">
        <div className="spinner" />
      </div>
    );
  }

  // Not authenticated → redirect to login, preserving the intended URL
  if (!session || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Inactive account (admin deactivated this user)
  if (profile.is_active === false) {
    return (
      <div className="error-screen">
        <h1>Account Deactivated</h1>
        <p>Your account has been deactivated. Please contact your organization admin.</p>
      </div>
    );
  }

  // Check subscription status
  // Allow trialing and active. Block cancelled and expired.
  const blockedStatuses = ['cancelled', 'expired'];
  if (subscription && blockedStatuses.includes(subscription.status)) {
    return <Navigate to="/billing?status=cancelled" replace />;
  }

  // Admin-only routes
  if (requireAdmin && profile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
