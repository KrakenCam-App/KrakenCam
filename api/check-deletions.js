/**
 * api/check-deletions.js
 *
 * Vercel cron job — runs daily at 10:00 AM UTC.
 * Finds cancelled orgs whose data_delete_at is exactly 15 days away
 * and sends a "your data will be permanently deleted" warning email.
 *
 * Secured with CRON_SECRET header.
 * Schedule: "0 10 * * *" (see vercel.json)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nszoateefidwhhsyexjd.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.APP_URL || 'https://app.krakencam.com'
const INTERNAL_EMAIL_SECRET = process.env.INTERNAL_EMAIL_SECRET || 'krakencam-internal-2024'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers['authorization']
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  try {
    const now = new Date()
    // Window: orgs whose data_delete_at is between 14 and 16 days from now
    // This catches orgs exactly 15 days away even if the cron runs slightly off
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const in16Days = new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000)

    // Query cancelled orgs with deletion date in ~15 days
    const orgsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/organizations?` +
      `subscription_status=in.(cancelled,canceled)` +
      `&data_delete_at=gte.${in14Days.toISOString()}` +
      `&data_delete_at=lte.${in16Days.toISOString()}` +
      `&select=id,name,data_delete_at`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        }
      }
    )

    if (!orgsRes.ok) {
      const err = await orgsRes.text()
      console.error('[check-deletions] Failed to query orgs:', err)
      return res.status(500).json({ error: 'Failed to query organizations' })
    }

    const orgs = await orgsRes.json()

    if (!orgs || orgs.length === 0) {
      console.log('[check-deletions] No orgs approaching deletion')
      return res.status(200).json({ sent: 0 })
    }

    let sent = 0

    for (const org of orgs) {
      try {
        // Get admin profile for this org
        const profileRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?organization_id=eq.${org.id}&role=eq.admin&select=email,full_name&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            }
          }
        )

        const profiles = await profileRes.json()
        if (!profiles?.[0]?.email) {
          console.warn(`[check-deletions] No admin profile for org ${org.id}`)
          continue
        }

        const { email, full_name } = profiles[0]
        const firstName = full_name ? full_name.split(' ')[0] : 'there'

        // Format deletion date for email
        const deletionDate = new Date(org.data_delete_at).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        })

        // Send deletion warning email
        const emailRes = await fetch(`${APP_URL}/api/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': INTERNAL_EMAIL_SECRET,
          },
          body: JSON.stringify({
            type: 'deletion_warning',
            to: email,
            firstName,
            orgName: org.name,
            deletionDate,
          })
        })

        if (emailRes.ok) {
          sent++
          console.log(`[check-deletions] Sent deletion warning to ${email} (org: ${org.id}, deletes: ${org.data_delete_at})`)
        } else {
          const err = await emailRes.json()
          console.error(`[check-deletions] Failed to send email for org ${org.id}:`, err)
        }
      } catch (err) {
        console.error(`[check-deletions] Error processing org ${org.id}:`, err)
      }
    }

    return res.status(200).json({ sent })
  } catch (err) {
    console.error('[check-deletions] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
