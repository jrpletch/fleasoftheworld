export function parseDoi(value) {
  const text = Array.isArray(value) ? value[0] : value
  const match = String(text || '').trim().match(/10\.\d{4,9}\/[^\s<>"']+/i)
  return match ? match[0].replace(/[.,;:]+$/, '') : ''
}

export async function lookupDoi(value) {
  const doi = parseDoi(value)
  if (!doi) throw new Error('Enter a valid DOI.')

  const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) throw new Error('We could not find that DOI. You can enter the citation details manually.')

  const { message } = await response.json()
  const dateParts = message.published?.['date-parts']?.[0]
    || message['published-print']?.['date-parts']?.[0]
    || message['published-online']?.['date-parts']?.[0]
    || message.issued?.['date-parts']?.[0]
    || []

  return {
    doi,
    title: message.title?.[0] || '',
    authors: (message.author || []).map((author) => [author.given, author.family].filter(Boolean).join(' ')).join('; '),
    year: dateParts[0] ? String(dateParts[0]) : '',
    journal: message['container-title']?.[0] || message.publisher || '',
    volume: message.volume || '',
    issue: message.issue || '',
    pages: message.page || message['article-number'] || ''
  }
}
