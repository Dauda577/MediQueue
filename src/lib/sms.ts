const SMS_API = 'https://sms.arkesel.com/api/v2/sms/send'
const SENDER = import.meta.env.VITE_ARKESEL_SENDER ?? 'MediQueue'
const API_KEY = import.meta.env.VITE_ARKESEL_API_KEY ?? ''

export async function sendSms(phone: string, message: string): Promise<{ ok: boolean }> {
  if (!API_KEY) {
    console.warn('[sms] VITE_ARKESEL_API_KEY not set — skipping SMS.')
    return { ok: false }
  }
  try {
    const res = await fetch(SMS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': API_KEY },
      body: JSON.stringify({ sender: SENDER, recipients: [phone], message }),
    })
    return { ok: res.ok }
  } catch (err) {
    console.error('[sms] send failed:', err)
    return { ok: false }
  }
}