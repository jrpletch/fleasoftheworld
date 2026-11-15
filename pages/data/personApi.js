import { makeAPIRequest } from '@/utils/request'

const PAGE_SIZE = 500
const OTU_CHUNK = 40
const COLLECTED_PAGE_SIZE = 200
const FLEA_CITATION_TYPES = [
  'TaxonName',
  'TaxonNameRelationship',
  'AssertedDistribution',
  'BiologicalAssociation',
  'CollectionObject'
]

function query(entries) {
  const params = new URLSearchParams()
  entries.forEach(([key, value]) => params.append(key, value))
  return params.toString()
}

const idParams = (key, ids) => ids.map((id) => [`${key}[]`, id])

async function getAll(path, entries) {
  const first = await makeAPIRequest.get(
    `${path}?${query([...entries, ['per', PAGE_SIZE], ['page', 1]])}`
  )
  const total = Number(first.headers?.['pagination-total'] || 0)
  const pages = Math.ceil(total / PAGE_SIZE)
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      makeAPIRequest.get(
        `${path}?${query([...entries, ['per', PAGE_SIZE], ['page', i + 2]])}`
      )
    )
  )
  return [first, ...rest].flatMap((response) => response.data || [])
}

// Keeps only simple emphasis tags from TaxonWorks HTML strings
export function safeHtml(html) {
  return String(html || '')
    .replace(/<(?!\/?(?:i|em|b|strong)\b)[^>]*>/gi, '')
    .replace(/<(\/?)(i|em|b|strong)\b[^>]*>/gi, '<$1$2>')
}

export function personName(person) {
  return [person.prefix, person.first_name, person.last_name, person.suffix]
    .filter(Boolean)
    .join(' ')
}

// The autocomplete label is HTML with the life dates, usage count and roles
function parseSuggestion(item) {
  const doc = new DOMParser().parseFromString(item.label_html || '', 'text/html')
  const spans = [...doc.querySelectorAll('span')]
  const text = (span) => span.textContent.replace(/\s+/g, ' ').trim()

  const uses = Number(doc.querySelector('[data-count]')?.dataset.count || 0)
  const lived = spans.map(text).find((t) => t.startsWith('lived:')) || ''
  const roles =
    spans
      .map(text)
      .find((t) => /(Author|Collector|Determiner|Editor)/.test(t) && !t.startsWith('lived:')) || ''

  return { id: item.id, label: item.label, lived: lived.replace('lived:', '').trim(), uses, roles }
}

const SIPHONAPTERA_TAXON_NAME_ID = 1534291
// Sources cited only on a couple of flea records can still belong to people who
// work on other insects, so a lone citation of that kind isn't enough
const MIN_FLEA_DATA_SOURCES = 3

function total(path, entries) {
  return makeAPIRequest
    .get(`${path}?${query([...entries, ['per', 1]])}`)
    .then((r) => Number(r.headers?.['pagination-total'] || 0))
    .catch(() => 0)
}

// Keeps people who study fleas: they authored flea taxon names, or sources cited
// on flea taxon names, or several sources cited on flea data. This drops
// authors of general insect literature and workers on other groups.
async function describeFleaWork(person) {
  const author = ['author_id[]', person.id]
  const [authored, onFleaNames, namesAuthored, onFleaData] = await Promise.all([
    total('/sources', [author, ['in_project', true]]),
    total('/sources', [
      author,
      ['in_project', true],
      ['taxon_name_id[]', SIPHONAPTERA_TAXON_NAME_ID],
      ['descendants', true]
    ]),
    total('/taxon_names', [
      ['taxon_name_author_id[]', person.id],
      ['ancestor_id', SIPHONAPTERA_TAXON_NAME_ID]
    ]),
    total('/sources', [
      author,
      ['in_project', true],
      ...FLEA_CITATION_TYPES.map((type) => ['citation_object_type[]', type])
    ])
  ])

  return {
    publications: authored,
    isFleaWorker:
      onFleaNames > 0 || namesAuthored > 0 || onFleaData >= MIN_FLEA_DATA_SOURCES
  }
}

export async function searchPeople(term) {
  const { data } = await makeAPIRequest.get(
    `/people/autocomplete?${query([['term', term]])}`
  )
  const candidates = (data || [])
    .map(parseSuggestion)
    .filter((p) => /Author/.test(p.roles))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 12)

  const work = await Promise.all(candidates.map(describeFleaWork))
  return candidates
    .map((p, i) => ({ ...p, publications: work[i].publications, isFleaWorker: work[i].isFleaWorker }))
    .filter((p) => p.isFleaWorker && p.publications > 0)
}

const normalizePersonName = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, '')

function matchesAuthorName(authorName, personLabel) {
  if (normalizePersonName(authorName) === normalizePersonName(personLabel)) return true

  const authorParts = authorName.includes(',')
    ? authorName.split(',').map((part) => part.trim())
    : [authorName.trim().split(/\s+/).at(-1), authorName.trim().split(/\s+/).slice(0, -1).join(' ')]
  const personParts = String(personLabel || '').split(',').map((part) => part.trim())
  const authorSurname = normalizePersonName(authorParts[0])
  const personSurname = normalizePersonName(personParts[0])
  if (!authorSurname || authorSurname !== personSurname || !personParts[1]) return false

  const initials = (value) => {
    const tokens = String(value || '').match(/[a-z]+/gi) || []
    return tokens.length && tokens.every((token) => token.length === 1)
      ? tokens.join('').toLocaleLowerCase()
      : tokens.map((token) => token[0].toLocaleLowerCase()).join('')
  }
  const authorInitials = initials(authorParts[1] || '')
  const personInitials = initials(personParts[1])
  return authorInitials.length > 0 && authorInitials === personInitials
}

const siphonapteristAuthorCache = new Map()

// Resolve a source's full author names to people who qualify for the
// Siphonapterists directory, using the same flea-work check as its search.
export async function findSiphonapteristAuthors(authorString) {
  const authors = String(authorString || '')
    .split(/\s+and\s+/i)
    .map((name) => name.trim())
    .filter(Boolean)

  const matches = await Promise.all(authors.map(async (authorName) => {
    const cacheKey = normalizePersonName(authorName)
    if (!cacheKey) return null
    if (siphonapteristAuthorCache.has(cacheKey)) return siphonapteristAuthorCache.get(cacheKey)

    const surname = authorName.includes(',') ? authorName.split(',')[0].trim() : authorName.trim().split(/\s+/).at(-1)
    try {
      const { data } = await makeAPIRequest.get('/people/autocomplete', { params: { term: surname } })
      const person = (data || [])
        .map(parseSuggestion)
        .find((candidate) =>
          /Author/.test(candidate.roles) && matchesAuthorName(authorName, candidate.label)
        )
      if (!person) {
        siphonapteristAuthorCache.set(cacheKey, null)
        return null
      }

      const work = await describeFleaWork(person)
      const result = work.isFleaWorker && work.publications > 0
        ? { id: person.id, label: person.label }
        : null
      siphonapteristAuthorCache.set(cacheKey, result)
      return result
    } catch {
      return null
    }
  }))

  return matches.filter(Boolean)
}

// Biography text kept in the person's "Biography" data attribute in TaxonWorks, as paragraphs.
export async function fetchBiography(ids) {
  const { data } = await makeAPIRequest.get(
    `/data_attributes?${query([
      ['attribute_subject_type', 'Person'],
      ...ids.map((id) => ['attribute_subject_id[]', id]),
      ['per', 100]
    ])}`
  )
  const entry = (data || [])
    .filter((d) => d.predicate_name === 'Biography' && d.value?.trim())
    .sort((a, b) => ids.indexOf(a.attribute_subject_id) - ids.indexOf(b.attribute_subject_id))[0]
  if (!entry) return { paragraphs: [], citations: [] }

  let citationData = []
  try {
    const response = await makeAPIRequest.get('/citations', {
      params: {
        citation_object_type: 'DataAttribute',
        citation_object_id: [entry.id],
        extend: ['source'],
        per: 100
      }
    })
    citationData = response.data || []
  } catch {
    // The biography is still useful if its optional citations fail to load.
  }
  const citations = (citationData || [])
    .map((citation) => {
      const source = citation.source?.cached || citation.citation_source_body || ''
      if (!source.trim()) return null
      return {
        id: citation.id,
        html: safeHtml(source),
        pages: citation.pages || ''
      }
    })
    .filter(Boolean)

  return {
    paragraphs: entry.value.split(/\r?\n+/).map((p) => p.trim()).filter(Boolean),
    citations
  }
}

// First image depicting the person; earlier ids (the selected record) win over merged duplicates.
export async function fetchPortrait(ids) {
  const { data } = await makeAPIRequest.get(
    `/depictions?${query([
      ['depiction_object_type', 'Person'],
      ...ids.map((id) => ['depiction_object_id[]', id]),
      ['per', 50]
    ])}`
  )
  const depictions = (data || [])
    .filter((d) => ids.includes(d.depiction_object_id))
    .sort((a, b) => ids.indexOf(a.depiction_object_id) - ids.indexOf(b.depiction_object_id) || a.id - b.id)
  if (!depictions.length) return null

  const { data: image } = await makeAPIRequest.get(`/images/${depictions[0].image_id}`)
  return {
    src: image.medium || image.original,
    caption: depictions[0].caption || null
  }
}

export async function fetchPerson(id) {
  const { data } = await makeAPIRequest.get(`/people/${id}`)
  return data
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Bolds the person's name in a citation: the surname followed by initials
// that agree with their first name ("Smit, F.G.A.M.")
function boldAuthor(html, person) {
  if (!person?.last_name) return html
  const wanted = (person.first_name || '').match(/[A-Z]/g) || []
  const pattern = new RegExp(
    `${escapeRegExp(person.last_name)},\\s+((?:[A-Z][a-z]?\\.(?:-?[A-Z][a-z]?\\.)*\\s?)+)`,
    'g'
  )
  return html.replace(pattern, (match, initials) => {
    const letters = initials.match(/[A-Z]/g) || []
    const agrees = wanted.length ? letters[0] === wanted[0] : true
    return agrees ? `<b>${match.trimEnd()}</b>${match.endsWith(' ') ? ' ' : ''}` : match
  })
}

export async function fetchPublications(ids, person) {
  const sources = await getAll('/sources', [
    ...idParams('author_id', ids),
    ['in_project', true]
  ])
  return sources
    .map((s) => ({
      id: s.id,
      year: s.year ? Number(s.year) : null,
      citation: boldAuthor(
        safeHtml(s.cached)
          .replace(/\s*\[in [^\]]+\]/g, '')
          .replace(/\s*https:\/\/doi\.org\/\S+\s*$/, ''),
        person
      ),
      doi: s.doi || null
    }))
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.citation.localeCompare(b.citation))
}

async function otuIdsByTaxonName(taxonNameIds) {
  const unique = [...new Set(taxonNameIds.filter(Boolean))]
  const map = new Map()
  const chunks = []
  for (let i = 0; i < unique.length; i += OTU_CHUNK) chunks.push(unique.slice(i, i + OTU_CHUNK))

  const responses = await Promise.all(
    chunks.map((chunk) =>
      makeAPIRequest.get(
        `/otus?${query([...idParams('taxon_name_id', chunk), ['per', 100]])}`
      )
    )
  )
  responses
    .flatMap((r) => r.data || [])
    .forEach((otu) => {
      const nameId = String(otu.taxon_name_id)
      if (!map.has(nameId)) map.set(nameId, otu.id)
    })
  return map
}

async function taxonNamesById(taxonNameIds) {
  const unique = [...new Set(taxonNameIds.filter(Boolean).map(String))]
  const chunks = []
  for (let i = 0; i < unique.length; i += OTU_CHUNK) chunks.push(unique.slice(i, i + OTU_CHUNK))

  const responses = await Promise.all(
    chunks.map((chunk) =>
      makeAPIRequest.get(`/taxon_names?${query([...idParams('taxon_name_id', chunk), ['per', chunk.length]])}`)
    )
  )
  return new Map(responses.flatMap((response) => response.data || []).map((name) => [String(name.id), name]))
}

async function withOtus(names) {
  const invalidNames = names.filter((name) => name.cached_is_valid === false)
  const [otus, acceptedNames] = await Promise.all([
    otuIdsByTaxonName(names.flatMap((name) => [name.id, name.cached_valid_taxon_name_id])),
    taxonNamesById(invalidNames.map((name) => name.cached_valid_taxon_name_id))
  ])

  return names.map((name) => {
    const acceptedId = String(name.cached_valid_taxon_name_id || '')
    const acceptedName = acceptedNames.get(acceptedId)
    return {
      id: name.id,
      html: safeHtml(name.cached_html || name.cached),
      authorYear: name.cached_author_year || '',
      year: name.year_of_publication ? Number(name.year_of_publication) : name.year ? Number(name.year) : null,
      rank: name.rank || '',
      valid: name.cached_is_valid !== false,
      validName: acceptedName ? safeHtml(acceptedName.cached_html || acceptedName.cached || acceptedName.name) : '',
      validNameAuthorYear: acceptedName?.cached_author_year || '',
      validOtuId: acceptedId ? otus.get(acceptedId) || null : null,
      // Invalid names are displayed as plain text; their accepted name below
      // remains linked to the valid taxon page.
      otuId: name.cached_is_valid === false
        ? null
        : otus.get(String(name.id)) || otus.get(acceptedId) || null
    }
  })
}

const byYear = (a, b) =>
  (a.year ?? 9999) - (b.year ?? 9999) || a.html.localeCompare(b.html)

export async function fetchNamedBy(ids) {
  const names = await getAll('/taxon_names', idParams('taxon_name_author_id', ids))
  return (await withOtus(names)).sort(byYear)
}

const fold = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')

// Endings used to form species epithets from a person's surname
const EPITHET_ENDINGS = new Set([
  '', 'i', 'ii', 'ae', 'orum', 'arum', 'ianus', 'iana', 'ianum', 'anus', 'ana',
  'ia', 'ella', 'ina', 'inus', 'ensis'
])

// Taxon names are only matched by form: nothing in TaxonWorks says who a name
// honors unless the etymology was filled in, so this is a best guess
function honorsSurname(name, rank, stem) {
  const word = fold(name)
  if (!word.startsWith(stem)) return false
  const ending = word.slice(stem.length)
  if (EPITHET_ENDINGS.has(ending)) return true
  // Genera like Smitipsylla: surname plus a connecting vowel and a stem
  return /genus/i.test(rank) && ending.length >= 4 && /^[ioa]/.test(ending)
}

export async function fetchNamedFor(surname) {
  const stem = fold(surname)
  if (stem.length < 3) return []

  const candidates = await getAll('/taxon_names', [
    ['name', stem],
    ['exact', 'false']
  ])
  const matches = candidates.filter((n) => honorsSurname(n.name, n.rank || '', stem))
  return (await withOtus(matches)).sort(byYear)
}

// Georeferenced specimens, from the DwC records of collection objects the
// person collected
export async function fetchCollected(ids) {
  const entries = ids.map((id) => ['collection_object_query[collector_id][]', id])
  const first = await makeAPIRequest.get(
    `/dwc_occurrences?${query([...entries, ['per', COLLECTED_PAGE_SIZE], ['page', 1]])}`
  )
  const total = Number(first.headers?.['pagination-total'] || 0)
  const pages = Math.ceil(total / COLLECTED_PAGE_SIZE)
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      makeAPIRequest.get(
        `/dwc_occurrences?${query([...entries, ['per', COLLECTED_PAGE_SIZE], ['page', i + 2]])}`
      )
    )
  )

  const records = [first, ...rest].flatMap((r) => r.data || [])
  const toNumber = (v) => (v === null || v === '' || v === undefined ? NaN : Number(v))

  return {
    total,
    points: records
      .map((r) => ({
        id: r.dwc_occurrence_object_id,
        lat: toNumber(r.decimalLatitude),
        lng: toNumber(r.decimalLongitude),
        name: r.scientificName || '',
        locality: [r.locality, r.stateProvince, r.country].filter(Boolean).join(', '),
        date: r.eventDate || '',
        otuId: r.otu_id || null
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  }
}
