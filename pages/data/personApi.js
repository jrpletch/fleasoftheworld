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
    total('/sources', [author]),
    total('/sources', [
      author,
      ['taxon_name_id[]', SIPHONAPTERA_TAXON_NAME_ID],
      ['descendants', true]
    ]),
    total('/taxon_names', [
      ['taxon_name_author_id[]', person.id],
      ['ancestor_id', SIPHONAPTERA_TAXON_NAME_ID]
    ]),
    total('/sources', [
      author,
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
  return entry ? entry.value.split(/\r?\n+/).map((p) => p.trim()).filter(Boolean) : []
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
  const sources = await getAll('/sources', idParams('author_id', ids))
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
    .forEach((otu) => map.has(otu.taxon_name_id) || map.set(otu.taxon_name_id, otu.id))
  return map
}

async function withOtus(names) {
  const otus = await otuIdsByTaxonName(
    names.flatMap((n) => [n.id, n.cached_valid_taxon_name_id])
  )
  return names.map((n) => ({
    id: n.id,
    html: safeHtml(n.cached_html || n.cached),
    authorYear: n.cached_author_year || '',
    year: n.year_of_publication ? Number(n.year_of_publication) : n.year ? Number(n.year) : null,
    rank: n.rank || '',
    valid: n.cached_is_valid !== false,
    otuId: otus.get(n.id) || otus.get(n.cached_valid_taxon_name_id) || null
  }))
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
