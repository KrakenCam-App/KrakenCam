/**
 * api/create-portal-session.js
 *
 * Creates a Stripe Customer Portal session so users can manage their
 * subscription (update payment method, cancel, view invoices, etc.)
 * without us having to build a custom billing UI.
 *
 * SECURITY:
 * - Requires authenticated admin user
 * - Organization ID pulled from server-side profile lookup
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Verify user is an admin
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return res.status(403).json({ error: 'Only org admins can access the billing portal' });
  }

  // Get the org's Stripe customer ID
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', profile.organization_id)
    .single();

  if (!org?.stripe_customer_id) {
    return res.status(400).json({
      error: 'No Stripe customer found. Please complete your first subscription checkout.',
    });
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   org.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (err) {
    console.error('[create-portal-session] Stripe error:', err);
    return res.status(500).json({ error: 'Failed to create portal session' });
  }
}
