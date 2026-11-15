const CONTRIBUTION_API_URL = import.meta.env.VITE_CONTRIBUTION_API_URL || ''
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

export const isContributionServiceConfigured = Boolean(
  CONTRIBUTION_API_URL && TURNSTILE_SITE_KEY
)

export async function submitContribution(type, fields, turnstileToken) {
  if (!isContributionServiceConfigured) {
    throw new Error('Online submissions are currently inactive while the website is under construction.')
  }
  if (!turnstileToken) {
    throw new Error('Complete the spam check before submitting.')
  }

  let response
  try {
    response = await fetch(CONTRIBUTION_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        fields,
        website: fields.company,
        turnstileToken
      })
    })
  } catch {
    throw new Error('We could not reach the submission service. Check your connection and try again.')
  }

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || 'We could not send your submission. Please try again later.')
  }
  return result
}
