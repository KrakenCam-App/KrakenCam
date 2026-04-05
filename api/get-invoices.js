/**
 * api/get-invoices.js
 *
 * Returns the last 24 Stripe invoices for the authenticated org.
 * Each invoice includes a PDF download URL and hosted view URL.
 *
 * SECURITY:
 * - Requires authenticated admin user (Supabase JWT)
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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return res.status(403).json({ error: 'Only org admins can view invoices' });
  }

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', profile.organization_id)
    .single();

  if (!org?.stripe_customer_id) {
    return res.status(200).json({ invoices: [] });
  }

  try {
    const { data: stripeInvoices } = await stripe.invoices.list({
      customer: org.stripe_customer_id,
      limit: 24,
    });

    const invoices = stripeInvoices.map(inv => ({
      id:                  inv.id,
      number:              inv.number || inv.id,
      amount_paid:         inv.amount_paid,
      currency:            inv.currency,
      status:              inv.status,
      created:             inv.created,
      invoice_pdf:         inv.invoice_pdf,
      hosted_invoice_url:  inv.hosted_invoice_url,
    }));

    return res.status(200).json({ invoices });
  } catch (err) {
    console.error('[get-invoices] Stripe error:', err);
    return res.status(500).json({ error: 'Failed to load invoices' });
  }
}
