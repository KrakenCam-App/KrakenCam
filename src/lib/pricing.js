import { supabase } from './supabase'

// Load all pricing config from DB
export async function getPricingConfig() {
  const { data, error } = await supabase.from('pricing_config').select('*')
  if (error) throw error
  // Convert to nested object: { capture_i: { monthly: { admin: 39, per_seat: 29 }, annual: { admin: 33, per_seat: 26 } }, ... }
  const config = {}
  for (const row of data) {
    if (!config[row.tier]) config[row.tier] = {}
    if (!config[row.tier][row.billing_period]) config[row.tier][row.billing_period] = {}
    config[row.tier][row.billing_period][row.price_type] = row.amount
  }
  return config
}

// Full rows with metadata (updated_at, stripe_price_id, etc.)
export async function getPricingConfigRaw() {
  const { data, error } = await supabase.from('pricing_config').select('*').order('id')
  if (error) throw error
  return data
}

// Default pricing fallback (hardcoded)
export const DEFAULT_PRICING = {
  capture_i: { monthly: { admin: 39, per_seat: 29 }, annual: { admin: 33, per_seat: 26 } },
  intelligence_ii: { monthly: { admin: 59, per_seat: 29 }, annual: { admin: 50, per_seat: 26 } },
  command_iii: { monthly: { admin: 79, per_seat: 29 }, annual: { admin: 67, per_seat: 26 } },
}
