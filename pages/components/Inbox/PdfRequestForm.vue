<template>
  <form class="pdf-form rounded-xl border border-base-border bg-base-foreground p-5 sm:p-6" @submit.prevent="submit">
    <p v-if="form.citation" class="mb-3 rounded-md bg-base-background px-3 py-2 text-[12px] leading-relaxed text-base-content/65">
      <span class="font-semibold">Database reference:</span> <cite>{{ form.citation }}</cite>
    </p>
    <div class="pdf-fields grid min-w-0 grid-cols-12 gap-x-3 gap-y-3">
      <div class="col-span-12 min-w-0">
        <label for="request-doi" class="field-label">DOI <span class="font-normal normal-case tracking-normal text-base-content/50">(searches for matches below)</span></label>
        <div class="flex gap-1.5">
          <input id="request-doi" v-model.trim="form.doi" class="form-field min-w-0 flex-1" placeholder="10.xxxx/example or https://doi.org/..." />
          <button type="button" class="clear-button" :disabled="isSubmitting || isLookingUpDoi" @click="clearForm">Clear form</button>
        </div>
        <p class="mt-1.5 text-[11px] leading-4 text-base-content/50">No DOI? Fill in what you know.</p>
      </div>

      <label class="col-span-12 min-w-0">
        <span class="field-label">Author(s)</span>
        <input v-model.trim="form.authors" class="form-field mt-1" placeholder="e.g. Rothschild, N.C." />
      </label>
      <label class="col-span-3 min-w-0 sm:col-span-2">
        <span class="field-label">Year</span>
        <input v-model.trim="form.year" inputmode="numeric" class="form-field mt-1" />
      </label>
      <label class="col-span-9 min-w-0 sm:col-span-10">
        <span class="field-label">Title <span class="font-normal normal-case tracking-normal text-base-content/50">(use quotes for exact phrases)</span></span>
        <input v-model.trim="form.title" class="form-field mt-1" />
      </label>
      <label class="col-span-12 min-w-0 sm:col-span-8">
        <span class="field-label">Journal or book</span>
        <input v-model.trim="form.journal" class="form-field mt-1" />
      </label>
      <label class="col-span-6 min-w-0 sm:col-span-2">
        <span class="field-label">Volume</span>
        <input v-model.trim="form.volume" class="form-field mt-1" />
      </label>
      <label class="col-span-6 min-w-0 sm:col-span-2">
        <span class="field-label">Pages</span>
        <input v-model.trim="form.pages" class="form-field mt-1" />
      </label>
      <div v-if="isFindingMatches || hasCompletedMatchSearch || matchingPublications.length || matchSearchMessage" class="col-span-12 rounded-xl bg-amber-50 p-3 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-base-content dark:ring-amber-400/20 sm:p-4" role="status">
        <div class="flex items-start gap-2.5">
          <span class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-bold text-amber-800 dark:text-amber-300" aria-hidden="true">!</span>
          <div class="min-w-0 flex-1">
            <h3 class="text-[14px] font-semibold">{{ isFindingMatches ? 'Checking the project bibliography' : hasCompletedMatchSearch && !matchingPublications.length && !matchSearchMessage ? 'No matching publications found' : 'Possible matching publications in the database' }}</h3>
            <p v-if="isFindingMatches" class="mt-1 text-[13px] leading-relaxed opacity-75">Searching by the publication details you entered…</p>
            <p v-else-if="matchSearchMessage" class="mt-1 text-[13px] leading-relaxed opacity-75">{{ matchSearchMessage }}</p>
            <p v-else-if="hasCompletedMatchSearch && !matchingPublications.length" class="mt-1 text-[13px] leading-relaxed opacity-75">No citations match these details in the project bibliography.</p>
            <div v-if="hasCompletedMatchSearch && !matchingPublications.length && !matchSearchMessage && parseDoi(form.doi) && !hasLookedUpDoi" class="mt-3 flex flex-wrap items-center gap-3">
              <p class="text-[13px] leading-relaxed opacity-75">Use the DOI to fill in the citation details.</p>
              <button type="button" class="lookup-button" :disabled="isLookingUpDoi" @click="lookupDoiDetails">
                {{ isLookingUpDoi ? 'Looking up…' : 'Look up DOI details' }}
              </button>
            </div>
            <ol v-if="matchingPublications.length" class="mt-2 max-h-52 list-decimal space-y-3 overflow-y-auto pl-5">
              <li v-for="publication in matchingPublications" :key="publication.key" class="pl-1 text-[13px] leading-[1.45]">
                <RouterLink :to="{ path: '/resources/tw/filter/bibliography', query: { query_term: publication.searchTerm } }" class="font-semibold text-primary-color hover:underline">
                  {{ publication.title || 'Untitled publication' }}
                </RouterLink>
                <p v-if="publication.metadata" class="mt-0.5 text-[12px] opacity-75">{{ publication.metadata }}</p>
                <button type="button" class="lookup-button mt-1.5" @click="selectPublication(publication)">Use this reference</button>
              </li>
            </ol>
          </div>
        </div>
      </div>
      <label class="col-span-12 min-w-0">
        <span class="field-label">Note <span class="font-normal normal-case tracking-normal text-base-content/50">(optional)</span></span>
        <textarea v-model.trim="form.notes" rows="2" class="form-field mt-1 resize-y" />
      </label>
      <label class="col-span-6 min-w-0">
        <span class="field-label">Your name</span>
        <input v-model.trim="form.name" required autocomplete="name" class="form-field mt-1" />
      </label>
      <label class="col-span-6 min-w-0">
        <span class="field-label">E-mail</span>
        <input v-model.trim="form.email" type="email" required autocomplete="email" class="form-field mt-1" />
      </label>
      <label class="col-span-12 min-w-0">
        <span class="field-label">Institution <span class="font-normal normal-case tracking-normal text-base-content/50">(optional)</span></span>
        <input v-model.trim="form.institution" autocomplete="organization" class="form-field mt-1" />
      </label>
      <div class="col-span-12">
        <TurnstileChallenge ref="turnstileWidget" v-model="turnstileToken" />
      </div>
      <label class="honeypot" aria-hidden="true">
        Leave this field empty
        <input v-model="form.company" tabindex="-1" autocomplete="off" />
      </label>
    </div>

    <div class="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-base-border pt-4">
      <p class="max-w-[380px] text-[12px] leading-[1.5] text-base-content/65">Your contact details are sent privately to the editors.</p>
      <div class="flex items-center gap-2">
        <button type="submit" class="submit-button" :disabled="!isContributionServiceConfigured || isSubmitting || isSubmitted">
          {{ isSubmitted ? 'Request sent' : isSubmitting ? 'Sending...' : 'Request PDF' }}
        </button>
      </div>
    </div>
    <p v-if="status" class="mt-3 text-[13px] leading-relaxed text-base-content/75" role="status">{{ status }}</p>
  </form>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { makeAPIRequest } from '@/utils/request'
import TurnstileChallenge from './TurnstileChallenge.vue'
import { isContributionServiceConfigured, submitContribution } from '../../data/contributionSubmission.js'
import { lookupDoi, parseDoi } from './doiLookup.js'

const props = defineProps({
  citation: { type: String, default: '' },
  sourceId: { type: String, default: '' },
  doi: { type: String, default: '' },
  source: { type: Object, default: () => ({}) }
})
const initialSource = props.source || {}
const form = reactive({
  name: '', email: '', institution: '',
  citation: props.citation || plainText(initialSource.cached),
  sourceId: props.sourceId,
  doi: parseDoi(props.doi || initialSource.doi),
  title: plainText(initialSource.title),
  authors: plainText(initialSource.cached_author_string || initialSource.author_string || initialSource.authors),
  year: initialSource.year ? String(initialSource.year) : '',
  journal: sourceText(initialSource.journal || initialSource.journal_title || initialSource.container_title),
  volume: sourceText(initialSource.volume),
  pages: sourceText(initialSource.pages),
  notes: '', company: ''
})
const hasSelectedDatabaseSource = ref(Boolean(props.sourceId))
const isFindingMatches = ref(false)
const hasCompletedMatchSearch = ref(false)
const isLookingUpDoi = ref(false)
const hasLookedUpDoi = ref(false)
const isSubmitting = ref(false)
const isSubmitted = ref(false)
const status = ref('')
const matchingPublications = ref([])
const matchSearchMessage = ref('')
const turnstileToken = ref('')
const turnstileWidget = ref(null)
let matchSearchId = 0
let matchSearchTimer
let applyingSelectedPublication = false

function plainText(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim()
}

async function lookupDoiDetails() {
  const doi = parseDoi(form.doi)
  if (!doi || isLookingUpDoi.value) return
  isLookingUpDoi.value = true
  status.value = ''
  try {
    const details = await lookupDoi(doi)
    for (const key of ['title', 'authors', 'year', 'journal', 'pages']) {
      if (!form[key] && details[key]) form[key] = details[key]
    }
    if (!form.volume) form.volume = [details.volume, details.issue ? `(${details.issue})` : ''].filter(Boolean).join(' ')
    form.doi = details.doi
    hasLookedUpDoi.value = true
    status.value = 'DOI details found. Please check the citation before sending.'
  } catch (error) {
    status.value = error.message || 'DOI lookup failed. Enter the citation details manually.'
  } finally {
    isLookingUpDoi.value = false
  }
}

function sourceText(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (value && typeof value === 'object') return String(value.name || value.cached || value.title || '').trim()
  return ''
}

function normalizeTitle(value) {
  return plainText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function titleSearchText(value) {
  return String(value || '')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/"([^"]+)"/g, '$1')
    .trim()
}

function quotedTitlePhrases(value) {
  const normalizedQuotes = String(value || '').replace(/[\u201c\u201d]/g, '"')
  return [...normalizedQuotes.matchAll(/"([^"]+)"/g)].map((match) => normalizeTitle(match[1])).filter(Boolean)
}

function hasQuotedTitlePhrases(query, candidate) {
  const normalizedCandidate = normalizeTitle(candidate)
  return quotedTitlePhrases(query).every((phrase) => normalizedCandidate.includes(phrase))
}

function titleSimilarity(query, candidate) {
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
  if (!queryWords.length || !candidateWords.length) return false
  return queryWords.every((word) => candidateWords.some((candidateWord) =>
    candidateWord === word
      || (word.length > 1 && candidateWord.startsWith(word))
      || (candidateWord.length > 2 && word.startsWith(candidateWord))
  ))
}

function volumeMatches(query, candidate) {
  const queryValue = normalizeTitle(query)
  const candidateWords = normalizeTitle(candidate).split(' ').filter(Boolean)
  return Boolean(queryValue && candidateWords.includes(queryValue))
}

function publicationRelevance(source, { doi, title, authors, year, journal, volume }) {
  const sourceDoi = parseDoi(source.doi || source.cached || '')
  if (doi && sourceDoi && sourceDoi.toLowerCase() === doi.toLowerCase()) return 2

  const titleScore = titleSimilarity(title, source.title || source.cached || '')
  const authorScore = authorSimilarity(authors, source.cached_author_string || source.author_string || source.authors || '')
  const sourceYear = Number.parseInt(source.year, 10)
  const queryYear = Number.parseInt(year, 10)
  const yearDistance = year && Number.isFinite(sourceYear) && Number.isFinite(queryYear)
    ? Math.abs(sourceYear - queryYear)
    : null
  const yearScore = !year ? 0 : yearDistance === null ? 0.25 : Math.max(0, 1 - yearDistance / 6)
  const sourceJournal = sourceText(source.journal || source.journal_title || source.container_title)
  const sourceVolume = sourceText(source.volume)
  const journalScore = journalMatches(journal, sourceJournal) ? 1 : 0
  const volumeScore = volumeMatches(volume, sourceVolume) ? 1 : 0
  const hasTitle = Boolean(normalizeTitle(title))
  const hasAuthors = Boolean(normalizeTitle(authors))
  const hasYear = Boolean(year)
  const hasJournal = Boolean(normalizeTitle(journal))
  const hasVolume = Boolean(normalizeTitle(volume))
  const weights = {
    title: hasTitle ? 0.15 : 0,
    authors: hasAuthors ? 0.4 : 0,
    year: hasYear ? 0.3 : 0,
    journal: hasJournal ? 0.1 : 0,
    volume: hasVolume ? 0.05 : 0
  }
  const totalWeight = weights.title + weights.authors + weights.year + weights.journal + weights.volume
  if (!totalWeight) return 0
  const score = (
    (titleScore * weights.title)
    + (authorScore * weights.authors)
    + (yearScore * weights.year)
    + (journalScore * weights.journal)
    + (volumeScore * weights.volume)
  ) / totalWeight
  return score - (hasAuthors && authorScore < 0.3 ? 0.12 : 0)
}

async function findMatchingPublications() {
  const doi = parseDoi(form.doi)
  const title = form.title.trim()
  const authors = form.authors.trim()
  const year = form.year.trim()
  const journal = form.journal.trim()
  const volume = form.volume.trim()
  const normalizedTitle = normalizeTitle(title)
  if (!doi && normalizedTitle.length < 3 && normalizeTitle(authors).length < 3 && !journal && !volume) return

  const searches = [
    ...[doi, normalizedTitle.length >= 3 ? titleSearchText(title) : ''].filter(Boolean).map((query_term) => ({ query_term })),
    ...(normalizeTitle(authors).length >= 3 ? [{ author: authors }] : []),
    ...(journal ? [{ query_term: journal }, { journal }] : []),
    ...(volume ? [{ query_term: volume }, { volume }] : [])
  ]
  const numericYear = Number.parseInt(year, 10)
  const yearFilter = year && Number.isFinite(numericYear)
    ? { year_start: numericYear - 5, year_end: numericYear + 5 }
    : {}
  const requestId = ++matchSearchId
  isFindingMatches.value = true
  hasCompletedMatchSearch.value = false
  matchingPublications.value = []
  matchSearchMessage.value = ''

  const responses = await Promise.allSettled(searches.map((search) =>
    makeAPIRequest.get('/sources', { params: { in_project: true, ...yearFilter, ...search, per: 250 } })
  ))
  if (requestId !== matchSearchId) return

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
    const titleScore = titleSimilarity(title, source.title || source.cached || '')
    if (authors && authorScore < 0.25) continue
    if (year && Number.isFinite(numericYear) && Number.isFinite(numericSourceYear) && Math.abs(numericYear - numericSourceYear) > 5) continue
    if (normalizedTitle.length >= 3 && titleScore < 0.2) continue
    if (!hasQuotedTitlePhrases(title, source.title || source.cached || '')) continue
    if (journal && !journalMatches(journal, sourceJournal)) continue
    if (volume && !volumeMatches(volume, sourceVolume)) continue

    const score = publicationRelevance(source, { doi, title, authors, year, journal, volume })
    if (score < 0.12) continue
    const key = source.id || `${source.title || ''}|${source.cached || ''}`
    const previous = ranked.get(key)
    if (previous && previous.score >= score) continue

    const authorsAndYear = [plainText(sourceAuthors), sourceYear].filter(Boolean).join(', ')
    const pages = sourceText(source.pages)
    const publicationDetails = [
      authorsAndYear,
      sourceJournal,
      [sourceVolume && `vol. ${sourceVolume}`, pages && `pp. ${pages}`].filter(Boolean).join(', ')
    ].filter(Boolean)
    ranked.set(key, {
      key,
      score,
      source,
      title: plainText(source.title) || sourceTitle,
      metadata: publicationDetails.join('. '),
      searchTerm: title || doi || authors || journal || volume
    })
  }

  matchingPublications.value = [...ranked.values()]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 8)
  if (!matchingPublications.value.length && responses.some((result) => result.status === 'rejected')) {
    matchSearchMessage.value = 'The bibliography could not be fully checked right now. Please try again later.'
  }
  isFindingMatches.value = false
  hasCompletedMatchSearch.value = true
}

function selectPublication(publication) {
  const source = publication.source
  applyingSelectedPublication = true
  hasSelectedDatabaseSource.value = true
  const sourceAuthors = source.cached_author_string || source.author_string || source.authors || ''
  form.sourceId = source.id ? String(source.id) : ''
  form.citation = plainText(source.cached) || publication.metadata
  form.doi = parseDoi(source.doi || source.cached || '') || form.doi
  form.title = plainText(source.title) || publication.title || form.title
  form.authors = plainText(sourceAuthors) || form.authors
  form.year = source.year ? String(source.year) : form.year
  form.journal = sourceText(source.journal || source.journal_title || source.container_title) || form.journal
  form.volume = sourceText(source.volume) || form.volume
  form.pages = sourceText(source.pages) || form.pages
  applyingSelectedPublication = false
  matchSearchId += 1
  clearTimeout(matchSearchTimer)
  matchingPublications.value = []
  matchSearchMessage.value = ''
  isFindingMatches.value = false
  hasCompletedMatchSearch.value = false
  hasLookedUpDoi.value = true
  status.value = 'Reference details added to the request. You can review or edit them before sending.'
}

watch(() => [form.doi, form.title, form.authors, form.year, form.journal, form.volume], (values, previousValues) => {
  if (applyingSelectedPublication || hasSelectedDatabaseSource.value) return
  matchSearchId += 1
  clearTimeout(matchSearchTimer)
  matchingPublications.value = []
  matchSearchMessage.value = ''
  isFindingMatches.value = false
  hasCompletedMatchSearch.value = false
  if (previousValues && values[0] !== previousValues[0]) hasLookedUpDoi.value = false
  const hasDoi = Boolean(parseDoi(form.doi))
  const hasSearchableTitle = normalizeTitle(form.title).length >= 3
  const hasSearchableAuthor = normalizeTitle(form.authors).length >= 3
  const hasJournalOrVolume = Boolean(form.journal.trim() || form.volume.trim())
  if (hasDoi || hasSearchableTitle || hasSearchableAuthor || hasJournalOrVolume) {
    matchSearchTimer = setTimeout(() => { void findMatchingPublications() }, 500)
  }
}, { flush: 'sync', immediate: true })

function clearForm() {
  matchSearchId += 1
  clearTimeout(matchSearchTimer)
  Object.assign(form, {
    name: '', email: '', institution: '', citation: '', sourceId: '', doi: '',
    title: '', authors: '', year: '', journal: '', volume: '', pages: '',
    notes: '', company: ''
  })
  isSubmitted.value = false
  status.value = ''
  matchingPublications.value = []
  matchSearchMessage.value = ''
  isFindingMatches.value = false
  hasCompletedMatchSearch.value = false
  hasLookedUpDoi.value = false
  turnstileToken.value = ''
  hasSelectedDatabaseSource.value = false
  turnstileWidget.value?.reset()
}

async function submit() {
  if (form.company) return
  if (!form.title && !form.citation && !form.doi) {
    status.value = 'Enter a publication title, full citation, or DOI.'
    return
  }
  if (isSubmitting.value || isSubmitted.value) return
  isSubmitting.value = true
  status.value = ''
  try {
    await submitContribution('pdf', { ...form }, turnstileToken.value)
    isSubmitted.value = true
    turnstileToken.value = ''
    status.value = 'Thank you. Your PDF request was sent to the editors.'
  } catch (error) {
    turnstileWidget.value?.reset()
    status.value = error.message || 'We could not send your request. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.pdf-fields > div,
.pdf-fields > label { min-width: 0; }
.field-label {
  display: block;
  color: color-mix(in srgb, var(--tp-base-content) 68%, transparent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.045em;
  line-height: 1.3;
  text-transform: uppercase;
}
.form-field {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 38px;
  box-sizing: border-box;
  border: 1px solid var(--tp-base-border);
  border-radius: 5px;
  background: var(--tp-base-background);
  padding: 0.5rem 0.7rem;
  color: var(--tp-base-content);
  font-size: 13px;
  line-height: 1.25;
  font-weight: 400;
}
.form-field::placeholder { color: var(--tp-base-soft); }
.form-field:focus-visible { border-color: var(--tp-secondary); outline: 2px solid color-mix(in srgb, var(--tp-secondary) 18%, transparent); outline-offset: 1px; }
.lookup-button {
  min-height: 38px;
  box-sizing: border-box;
  border: 1px solid var(--tp-base-border);
  border-radius: 6px;
  background: var(--tp-base-foreground);
  padding: 0 0.9rem;
  color: var(--tp-base-content);
  font-size: 12px;
  white-space: nowrap;
}
.lookup-button:hover:not(:disabled) { background: var(--tp-base-background); }
.lookup-button:disabled { cursor: not-allowed; opacity: 0.5; }
.submit-button {
  border-radius: 5px;
  background: var(--tp-primary);
  padding: 0.65rem 1rem;
  color: var(--tp-primary-content);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
}
.submit-button:hover { background: color-mix(in srgb, var(--tp-primary) 88%, black); }
.submit-button:focus-visible { outline: 2px solid var(--tp-secondary); outline-offset: 2px; }
.clear-button {
  border: 1px solid var(--tp-base-border);
  border-radius: 5px;
  background: var(--tp-base-foreground);
  padding: 0.65rem 1rem;
  color: var(--tp-base-content);
  font-size: 12px;
  line-height: 1.3;
}
.clear-button:hover:not(:disabled) { background: var(--tp-base-background); }
.clear-button:disabled { cursor: not-allowed; opacity: 0.5; }
.pdf-form { box-shadow: 0 5px 16px color-mix(in srgb, var(--tp-primary) 12%, transparent); }
.honeypot { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
</style>
