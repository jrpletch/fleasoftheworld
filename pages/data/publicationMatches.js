import { makeAPIRequest } from '@/utils/request'
import { parseDoi } from '../components/Inbox/doiLookup.js'

function plainText(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim()
}

function sourceText(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (value && typeof value === 'object') return String(value.name || value.cached || value.title || '').trim()
  return ''
}

function normalizeTitle(value) {
  return plainText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function titleSearchText(value) {
  return String(value || '').replace(/[\u201c\u201d]/g, '"').replace(/"([^"]+)"/g, '$1').trim()
}

function quotedTitlePhrases(value) {
  const normalizedQuotes = String(value || '').replace(/[\u201c\u201d]/g, '"')
  return [...normalizedQuotes.matchAll(/"([^"]+)"/g)].map((match) => normalizeTitle(match[1])).filter(Boolean)
}

function titleSimilarity(query, candidate, { fuzzyOcr = false } = {}) {
  const left = normalizeTitle(titleSearchText(query))
  const right = normalizeTitle(candidate)
  if (!left || !right) return 0
  if (left === right) return 1
  if (left.includes(right)) return 0.82
  if (right.includes(left)) return 0.72
  const queryWords = new Set(left.split(' ').filter(Boolean))
  const candidateWords = new Set(right.split(' ').filter(Boolean))
  const sharedWords = [...queryWords].filter((word) => candidateWords.has(word)).length
  const wordCoverage = sharedWords / Math.max(queryWords.size, 1)
  const unionSize = new Set([...queryWords, ...candidateWords]).size
  const wordJaccard = sharedWords / Math.max(unionSize, 1)
  const bigrams = (text) => new Set(Array.from({ length: Math.max(0, text.length - 1) }, (_, index) => text.slice(index, index + 2)))
  const leftBigrams = bigrams(left)
  const rightBigrams = bigrams(right)
  const sharedBigrams = [...leftBigrams].filter((bigram) => rightBigrams.has(bigram)).length
  const bigramDice = (2 * sharedBigrams) / Math.max(leftBigrams.size + rightBigrams.size, 1)
  if (fuzzyOcr) {
    const editSimilarity = (a, b) => {
      if (a === b) return 1
      if (Math.min(a.length, b.length) < 4) return 0
      if (Math.abs(a.length - b.length) > 2) return 0
      let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
      for (let row = 1; row <= a.length; row += 1) {
        const current = [row]
        for (let column = 1; column <= b.length; column += 1) {
          current[column] = Math.min(
            current[column - 1] + 1,
            previous[column] + 1,
            previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1)
          )
        }
        previous = current
      }
      return Math.max(0, 1 - previous[b.length] / Math.max(a.length, b.length))
    }
    const leftWords = left.split(' ').filter(Boolean)
    const rightWords = right.split(' ').filter(Boolean)
    const tokenCoverage = (words, otherWords) => words.reduce((total, word) => {
      const best = Math.max(0, ...otherWords.map((other) => editSimilarity(word, other)))
      return total + best
    }, 0) / Math.max(words.length, 1)
    const fuzzyQueryCoverage = tokenCoverage(leftWords, rightWords)
    const fuzzyCandidateCoverage = tokenCoverage(rightWords, leftWords)
    return (fuzzyQueryCoverage * 0.48) + (fuzzyCandidateCoverage * 0.3) + (bigramDice * 0.22)
  }
  return (wordCoverage * 0.55) + (wordJaccard * 0.2) + (bigramDice * 0.25)
}

function authorSimilarity(query, candidate) {
  const queryAuthors = new Set(normalizeTitle(query).split(' ').filter((part) => part.length > 1))
  const candidateAuthors = new Set(normalizeTitle(candidate).split(' ').filter((part) => part.length > 1))
  if (!queryAuthors.size || !candidateAuthors.size) return 0
  const editDistance = (left, right) => {
    const row = Array.from({ length: right.length + 1 }, (_, index) => index)
    for (let i = 1; i <= left.length; i += 1) {
      let diagonal = row[0]
      row[0] = i
      for (let j = 1; j <= right.length; j += 1) {
        const above = row[j]
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1))
        diagonal = above
      }
    }
    return row[right.length]
  }
  const tokenScore = (word) => Math.max(0, ...[...candidateAuthors].map((candidateWord) => {
    if (word === candidateWord) return 1
    if (word.length >= 3 && candidateWord.startsWith(word)) return 0.9
    if (candidateWord.length >= 3 && word.startsWith(candidateWord)) return 0.85
    const distance = editDistance(word, candidateWord)
    if (distance === 1 && word.length >= 5) return 0.75
    if (distance === 2 && word.length >= 8) return 0.55
    return 0
  }))
  return [...queryAuthors].reduce((total, word) => total + tokenScore(word), 0) / queryAuthors.size
}

function journalMatches(query, candidate) {
  const queryWords = normalizeTitle(query).split(' ').filter(Boolean)
  const candidateWords = normalizeTitle(candidate).split(' ').filter(Boolean)
  return Boolean(queryWords.length && candidateWords.length && queryWords.every((word) => candidateWords.some((candidateWord) => candidateWord === word || (word.length > 1 && candidateWord.startsWith(word)) || (candidateWord.length > 2 && word.startsWith(candidateWord)))))
}

function volumeMatches(query, candidate) {
  const queryValue = normalizeTitle(query)
  return Boolean(queryValue && normalizeTitle(candidate).split(' ').includes(queryValue))
}

function publicationRelevance(source, { doi, title, titleCandidates = [], authors, year, journal, volume }, { tolerateOcrErrors = false, titleOnly = false } = {}) {
  const sourceDoi = parseDoi(source.doi || source.cached || '')
  if (!titleOnly && doi && sourceDoi && sourceDoi.toLowerCase() === doi.toLowerCase()) return 2
  const titleScore = Math.max(0, ...[title, ...titleCandidates].filter(Boolean).map((candidate) => titleSimilarity(candidate, source.title || source.cached || '', { fuzzyOcr: titleOnly })))
  if (titleOnly) return titleScore
  const authorScore = authorSimilarity(authors, source.cached_author_string || source.author_string || source.authors || '')
  const sourceYear = Number.parseInt(source.year, 10)
  const queryYear = Number.parseInt(year, 10)
  const yearDistance = year && Number.isFinite(sourceYear) && Number.isFinite(queryYear) ? Math.abs(sourceYear - queryYear) : null
  const yearScore = !year ? 0 : yearDistance === null ? 0.25 : Math.max(0, 1 - yearDistance / 6)
  const sourceJournal = sourceText(source.journal || source.journal_title || source.container_title)
  const sourceVolume = sourceText(source.volume)
  const journalScore = journalMatches(journal, sourceJournal) ? 1 : 0
  const volumeScore = volumeMatches(volume, sourceVolume) ? 1 : 0
  const weights = {
    title: (normalizeTitle(title) || titleCandidates.some((candidate) => normalizeTitle(candidate))) ? (tolerateOcrErrors ? 0.3 : 0.15) : 0,
    authors: normalizeTitle(authors) ? (tolerateOcrErrors ? 0.25 : 0.4) : 0,
    year: year ? (tolerateOcrErrors ? 0.35 : 0.3) : 0,
    journal: normalizeTitle(journal) ? (tolerateOcrErrors ? 0.07 : 0.1) : 0,
    volume: normalizeTitle(volume) ? (tolerateOcrErrors ? 0.03 : 0.05) : 0
  }
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  if (!totalWeight) return 0
  const score = ((titleScore * weights.title) + (authorScore * weights.authors) + (yearScore * weights.year) + (journalScore * weights.journal) + (volumeScore * weights.volume)) / totalWeight
  return score - (normalizeTitle(authors) && authorScore < 0.3 ? (tolerateOcrErrors ? 0.04 : 0.12) : 0)
}

function pageTextTitleSimilarity(pageText, title) {
  const pageWords = normalizeTitle(pageText).split(' ').filter(Boolean)
  const titleWords = normalizeTitle(title).split(' ').filter(Boolean)
  if (!pageWords.length || !titleWords.length) return 0
  const pageWordSet = [...new Set(pageWords)]
  const similarityCache = new Map()
  const tokenSimilarity = (left, right) => {
    if (left === right) return 1
    if (Math.min(left.length, right.length) < 4) return 0
    const lengthDifferenceLimit = Math.min(left.length, right.length) >= 8 ? 3 : 2
    if (Math.abs(left.length - right.length) > lengthDifferenceLimit) return 0
    const key = `${left}|${right}`
    if (similarityCache.has(key)) return similarityCache.get(key)
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
    for (let row = 1; row <= left.length; row += 1) {
      const current = [row]
      for (let column = 1; column <= right.length; column += 1) {
        current[column] = Math.min(
          current[column - 1] + 1,
          previous[column] + 1,
          previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
        )
      }
      previous = current
    }
    const score = Math.max(0, 1 - previous[right.length] / Math.max(left.length, right.length))
    similarityCache.set(key, score)
    return score
  }
  const wordScore = (word) => Math.max(0, ...pageWordSet.map((pageWord) => tokenSimilarity(word, pageWord)))
  const coverage = titleWords.reduce((sum, word) => sum + wordScore(word), 0) / titleWords.length
  let position = 0
  let orderedMatches = 0
  for (const word of titleWords) {
    const foundAt = pageWords.findIndex((pageWord, index) => index >= position && tokenSimilarity(word, pageWord) >= 0.5)
    if (foundAt >= 0) {
      orderedMatches += 1
      position = foundAt + 1
    }
  }
  const orderedCoverage = orderedMatches / titleWords.length
  return (coverage * 0.7) + (orderedCoverage * 0.3)
}

function formatPublicationMatch(source, score, titleScore, searchTerm) {
  const sourceTitle = plainText(source.title) || plainText(source.cached)
  const authorsAndYear = [plainText(source.cached_author_string || source.author_string || source.authors), source.year].filter(Boolean).join(', ')
  const sourceJournal = sourceText(source.journal || source.journal_title || source.container_title)
  const sourceVolume = sourceText(source.volume)
  const pages = sourceText(source.pages)
  const details = [authorsAndYear, sourceJournal, [sourceVolume && `vol. ${sourceVolume}`, pages && `pp. ${pages}`].filter(Boolean).join(', ')].filter(Boolean)
  const key = source.id || `${source.title || ''}|${source.cached || ''}`
  return {
    key,
    id: source.id || key,
    score,
    titleScore,
    title: plainText(source.title) || sourceTitle,
    metadata: details.join('. '),
    citation: plainText(source.cached) || [authorsAndYear, plainText(source.title) || sourceTitle, sourceJournal, [sourceVolume, pages].filter(Boolean).join(', ')].filter(Boolean).join('. '),
    fields: {
      doi: parseDoi(source.doi || source.cached || ''),
      title: plainText(source.title) || sourceTitle,
      authors: plainText(source.cached_author_string || source.author_string || source.authors),
      year: String(source.year || ''),
      journal: sourceJournal,
      volume: sourceVolume,
      pages
    },
    searchTerm: searchTerm || plainText(source.title) || sourceTitle
  }
}

export function hasPublicationSearchCriteria(criteria = {}) {
  return Boolean(parseDoi(criteria.doi) || normalizeTitle(criteria.title).length >= 3 || criteria.titleCandidates?.some((title) => normalizeTitle(title).length >= 3) || normalizeTitle(criteria.authors).length >= 3 || criteria.journal?.trim() || criteria.volume?.trim())
}

export async function findProjectPublicationMatches(criteria = {}, { tolerateOcrErrors = false, titleOnly = false } = {}) {
  const doi = titleOnly ? '' : parseDoi(criteria.doi)
  const title = String(criteria.title || '').trim()
  const authors = titleOnly ? '' : String(criteria.authors || '').trim()
  const year = titleOnly ? '' : String(criteria.year || '').trim()
  const journal = titleOnly ? '' : String(criteria.journal || '').trim()
  const volume = titleOnly ? '' : String(criteria.volume || '').trim()
  const titleCandidates = [...new Set([title, ...(criteria.titleCandidates || [])].map((candidate) => String(candidate || '').trim()).filter((candidate) => normalizeTitle(candidate).length >= 3))]
  if (!hasPublicationSearchCriteria(criteria)) return { matches: [], message: '' }

  const titleQueryCandidates = titleOnly && titleCandidates.length
    ? [
        titleCandidates[0],
        ...(titleCandidates[0].split(/\s+/).length > 7
          ? titleCandidates[0].split(/\s+/).reduce((chunks, _word, index, words) => {
              if (index % 3 === 0 && words.slice(index, index + 4).length >= 4) chunks.push(words.slice(index, index + 4).join(' '))
              return chunks
            }, [])
          : []),
        ...titleCandidates.slice(1, 3)
      ]
    : titleCandidates
  const titleQueries = titleQueryCandidates.slice(0, 6).map(titleSearchText)
  const titleSearches = [...new Set([...(!titleOnly && doi ? [doi] : []), ...titleQueries].filter(Boolean))].map((query_term) => ({ query_term }))
  const searches = titleOnly ? titleSearches : [
    ...titleSearches,
    ...(normalizeTitle(authors).length >= 3 ? [{ author: authors }] : []),
    ...(journal ? [{ query_term: journal }, { journal }] : []),
    ...(volume ? [{ query_term: volume }, { volume }] : [])
  ]
  const numericYear = Number.parseInt(year, 10)
  const yearTolerance = tolerateOcrErrors ? 10 : 5
  const yearFilter = !titleOnly && year && Number.isFinite(numericYear) ? { year_start: numericYear - yearTolerance, year_end: numericYear + yearTolerance } : {}
  const responses = await Promise.allSettled(searches.map((search) => makeAPIRequest.get('/sources', {
    params: { in_project: true, ...yearFilter, ...search, per: 250 }
  })))
  const sources = responses.filter((result) => result.status === 'fulfilled').flatMap((result) => result.value.data || [])
  const ranked = new Map()
  for (const source of sources) {
    const sourceTitle = plainText(source.title) || plainText(source.cached)
    const sourceAuthors = source.cached_author_string || source.author_string || source.authors || ''
    const authorScore = authorSimilarity(authors, sourceAuthors)
    const sourceYear = String(source.year || '')
    const numericSourceYear = Number.parseInt(sourceYear, 10)
    const sourceJournal = sourceText(source.journal || source.journal_title || source.container_title)
    const sourceVolume = sourceText(source.volume)
    const titleScore = Math.max(0, ...titleCandidates.map((candidate) => titleSimilarity(candidate, source.title || source.cached || '', { fuzzyOcr: titleOnly })))
    if (!titleOnly) {
      if (!tolerateOcrErrors && authors && authorScore < 0.25) continue
      if (year && Number.isFinite(numericYear) && Number.isFinite(numericSourceYear) && Math.abs(numericYear - numericSourceYear) > yearTolerance) continue
      if (!tolerateOcrErrors && !quotedTitlePhrases(title).every((phrase) => normalizeTitle(source.title || source.cached || '').includes(phrase))) continue
      if (!tolerateOcrErrors && journal && !journalMatches(journal, sourceJournal)) continue
      if (!tolerateOcrErrors && volume && !volumeMatches(volume, sourceVolume)) continue
    }
    if (titleCandidates.some((candidate) => normalizeTitle(candidate).length >= 3) && titleScore < (titleOnly ? 0.35 : tolerateOcrErrors ? 0.1 : 0.2)) continue
    const score = publicationRelevance(source, { doi, title, titleCandidates, authors, year, journal, volume }, { tolerateOcrErrors, titleOnly })
    if (score < (titleOnly ? 0.35 : 0.12)) continue
    const key = source.id || `${source.title || ''}|${source.cached || ''}`
    const previous = ranked.get(key)
    if (previous && score <= previous.score) continue
    ranked.set(key, formatPublicationMatch(source, score, titleScore, title || titleCandidates[0] || doi || authors))
  }
  const matches = [...ranked.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 8)
  const message = !matches.length && responses.some((result) => result.status === 'rejected')
    ? 'The bibliography could not be fully checked right now. Please try again later.'
    : ''
  return { matches, message }
}

export async function findProjectPublicationMatchesFromText(text, { onQueries = () => {} } = {}) {
  const pageText = String(text || '').trim()
  if (pageText.length < 40) return { matches: [], message: '' }

  const lines = pageText.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 32)
  const lineOffsets = []
  let wordOffset = 0
  for (const line of lines) {
    lineOffsets.push(wordOffset)
    wordOffset += line.split(/\s+/).length
  }
  const searchQueries = new Map()
  const addQuery = (words, position) => {
    if (words.length < 3 || words.length > 24) return
    const query = words.join(' ').trim()
    if (query.length < 12 || query.length > 240) return
    const key = normalizeTitle(query)
    if (!key) return
    const previous = searchQueries.get(key)
    if (!previous || position < previous.position) searchQueries.set(key, { query, position })
  }

  for (let startLine = 0; startLine < lines.length; startLine += 1) {
    for (const lineCount of [3, 2, 1]) {
      const block = lines.slice(startLine, startLine + lineCount).join(' ')
      const words = block.split(/\s+/).filter(Boolean)
      addQuery(words, lineOffsets[startLine])
      // Short overlapping windows help retrieve a source when one OCR error
      // makes the complete title line fail the bibliography's text search.
      if (words.length > 3 && words.length <= 24) {
        for (const windowSize of [5, 4, 3]) {
          for (let startWord = 0; startWord + 3 <= words.length; startWord += windowSize > 3 ? 3 : 2) {
            const window = words.slice(startWord, startWord + windowSize)
            if (window.length >= 3) addQuery(window, lineOffsets[startLine] + startWord)
          }
        }
      }
      if (words.length > 24) {
        for (const windowSize of [16, 12, 8, 5]) {
          for (let startWord = 0; startWord + 3 <= words.length; startWord += 5) {
            const window = words.slice(startWord, startWord + windowSize)
            if (window.length >= 3) addQuery(window, lineOffsets[startLine] + startWord)
          }
        }
      }
    }
  }

  const queries = [...searchQueries.values()]
    .sort((a, b) => a.position - b.position || b.query.length - a.query.length)
    .slice(0, 72)
  const closeMatchThreshold = 0.78
  const searchablePageText = lines.join(' ')
  const possibleMatches = new Map()
  let hadSuccessfulSearch = false

  for (let batchStart = 0; batchStart < queries.length; batchStart += 6) {
    const batch = queries.slice(batchStart, batchStart + 6)
    onQueries(batch.map(({ query }) => query))
    const responses = await Promise.allSettled(batch.map(({ query }) => makeAPIRequest.get('/sources', {
      params: { in_project: true, query_term: query, per: 250 }
    })))
    const orderedBatchResults = responses.map((response, index) => ({ response, query: batch[index].query }))

    for (const { response, query } of orderedBatchResults) {
      if (response.status !== 'fulfilled') continue
      hadSuccessfulSearch = true
      const sources = Array.isArray(response.value.data) ? response.value.data : []
      for (const source of sources) {
        // Some TaxonWorks sources only expose the citation in `cached`.
        const sourceTitle = plainText(source.title || source.cached)
        if (!sourceTitle) continue
        const titleScore = pageTextTitleSimilarity(searchablePageText, sourceTitle)
        if (titleScore < 0.25) continue
        const match = formatPublicationMatch(source, titleScore, titleScore, sourceTitle)
        match.pageQuery = query
        const previous = possibleMatches.get(match.key)
        if (!previous || match.score > previous.score) possibleMatches.set(match.key, match)
      }
    }
    // Once a title is essentially exact, more broad searches are unlikely to
    // improve the shortlist. Otherwise, check the remaining phrase windows.
    if ([...possibleMatches.values()].some((match) => match.score >= 0.98)) break
  }

  const matches = [...possibleMatches.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 8)
  return {
    matches,
    highlightQueries: [...new Set(matches.slice(0, 3).map((match) => match.pageQuery).filter(Boolean))],
    closeMatch: matches.some((match) => match.score >= closeMatchThreshold),
    message: !hadSuccessfulSearch ? 'The bibliography could not be checked against the selected page. Please try again.' : ''
  }
}
