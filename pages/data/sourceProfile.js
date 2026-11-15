import { makeAPIRequest } from '@/utils/request'

const PAGE_SIZE = 250

function appendEntries(params, entries) {
  entries.forEach(([key, value]) => params.append(key, String(value)))
  return params
}

async function fetchAll(path, entries = []) {
  const params = appendEntries(new URLSearchParams({ per: String(PAGE_SIZE), page: '1' }), entries)
  const first = await makeAPIRequest.get(`${path}?${params.toString()}`)
  const total = Number(first.headers?.['pagination-total'] || first.data?.length || 0)
  const pageCount = Math.ceil(total / PAGE_SIZE)
  if (pageCount <= 1) return first.data || []

  const remaining = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => {
      const pageParams = appendEntries(new URLSearchParams({ per: String(PAGE_SIZE), page: String(index + 2) }), entries)
      return makeAPIRequest.get(`${path}?${pageParams.toString()}`)
    })
  )
  return [first, ...remaining].flatMap((response) => response.data || [])
}

function uniqueCitations(citations, type) {
  const records = new Map()
  for (const citation of citations.filter((item) => item.citation_object_type === type)) {
    const id = String(citation.citation_object_id)
    if (!records.has(id)) records.set(id, { id, pages: new Set() })
    if (citation.pages) records.get(id).pages.add(citation.pages)
  }
  return [...records.values()].map((record) => ({ ...record, pages: [...record.pages].join(', ') }))
}

function numberOrNaN(value) {
  return value === null || value === '' || value === undefined ? NaN : Number(value)
}

async function fetchSpecimen(citation) {
  const { data } = await makeAPIRequest.get(`/collection_objects/${citation.id}/dwc`)
  return { ...data, id: citation.id, pages: citation.pages }
}

async function fetchTaxonName(citation) {
  const { data } = await makeAPIRequest.get(`/taxon_names/${citation.id}`)
  return { ...data, pages: citation.pages }
}

async function fetchSourceImage(citation) {
  const { data } = await makeAPIRequest.get(`/images/${citation.id}`, {
    params: { extend: ['depictions', 'attribution'] }
  })
  return { ...data, id: String(citation.id), pages: citation.pages }
}

export async function fetchSourceProfile(sourceId) {
  const [sourceResponse, citationRecords, otuResponse] = await Promise.all([
    makeAPIRequest.get(`/sources/${sourceId}`),
    fetchAll('/citations', [['source_id', sourceId]]).catch(() => []),
    makeAPIRequest.get('/otus', {
      params: {
        'taxon_name_query[source_query][source_id][]': sourceId,
        per: PAGE_SIZE
      }
    }).catch(() => ({ data: [] }))
  ])

  const source = sourceResponse.data
  const otus = otuResponse.data || []
  const taxonNameCitations = uniqueCitations(citationRecords, 'TaxonName')
  const relationshipCitations = uniqueCitations(citationRecords, 'TaxonNameRelationship')
  const specimenCitations = uniqueCitations(citationRecords, 'CollectionObject')
  const distributionCitations = uniqueCitations(citationRecords, 'AssertedDistribution')
  const imageCitations = uniqueCitations(citationRecords, 'Image')
  const distributionIds = new Set(distributionCitations.map((citation) => String(citation.id)))
  const distributionPages = new Map(distributionCitations.map((citation) => [String(citation.id), citation.pages]))

  const [taxonResults, relationshipResults, specimenResults, imageResults, geoResults] = await Promise.all([
    Promise.allSettled(taxonNameCitations.map(fetchTaxonName)),
    Promise.allSettled(relationshipCitations.map(async (citation) => {
      const { data } = await makeAPIRequest.get(`/taxon_name_relationships/${citation.id}`)
      return { ...data, pages: citation.pages }
    })),
    Promise.allSettled(specimenCitations.map(fetchSpecimen)),
    Promise.allSettled(imageCitations.map(fetchSourceImage)),
    Promise.allSettled(
      otus.map((otu) => makeAPIRequest.get(`/otus/${otu.id}/inventory/distribution.geojson`))
    )
  ])

  const taxonNames = taxonResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
  const relationships = relationshipResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
  const specimens = specimenResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .sort((a, b) => String(a.scientificName || '').localeCompare(String(b.scientificName || '')))
  const images = imageResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((image) => image.thumb || image.medium || image.original)
    .sort((a, b) => Number(a.id) - Number(b.id))
  const mapFeaturesByAssertion = new Map()
  for (const result of geoResults) {
    if (result.status !== 'fulfilled') continue
    for (const feature of result.value.data?.features || []) {
      const properties = feature.properties || {}
      const id = String(properties.base?.id || '')
      if (properties.base?.type !== 'AssertedDistribution' || !distributionIds.has(id)) continue
      mapFeaturesByAssertion.set(id, { ...feature, properties: { ...properties, sourcePages: distributionPages.get(id) || '' } })
    }
  }

  // Several asserted-distribution records can describe the same taxon in the
  // same place. Keep one map feature per geographic area and combine its taxa.
  const areas = new Map()
  for (const feature of mapFeaturesByAssertion.values()) {
    const properties = feature.properties || {}
    const shape = properties.shape || {}
    const areaKey = `${shape.type || 'shape'}-${shape.id || feature.id}`
    const areaLabel = String(properties.base?.label || '').match(/\bin\s+(.+?)\s+\[Geographic Area\]$/i)?.[1]
      || `Geographic area ${shape.id || ''}`.trim()
    if (!areas.has(areaKey)) {
      areas.set(areaKey, {
        feature,
        areaLabel,
        assertions: new Map(),
        baseRecords: []
      })
    }
    const area = areas.get(areaKey)
    const taxonName = properties.target?.label || String(properties.base?.label || '').split(/\s+in\s+/i)[0]
    const assertionId = String(properties.base?.id || '')
    if (!area.assertions.has(taxonName)) {
      area.assertions.set(taxonName, { name: taxonName, otuId: properties.target?.id || null, pages: new Set(), count: 0 })
    }
    const taxon = area.assertions.get(taxonName)
    taxon.count += 1
    const pages = distributionPages.get(assertionId)
    if (pages) pages.split(', ').forEach((page) => taxon.pages.add(page))
    area.baseRecords.push({ ...properties.base, is_absent: properties.is_absent })
  }

  const distributionAreas = [...areas.values()].map(({ feature, areaLabel, assertions, baseRecords }) => ({
    ...feature,
    properties: {
      ...feature.properties,
      areaLabel,
      base: baseRecords,
      taxa: [...assertions.values()].map((taxon) => ({ ...taxon, pages: [...taxon.pages].join(', ') }))
    }
  }))

  const otuByTaxonName = new Map(otus.map((otu) => [String(otu.taxon_name_id), otu]))
  const taxaByName = new Map()
  for (const taxon of taxonNames) {
    const nameId = String(taxon.id)
    const otu = otuByTaxonName.get(nameId)
    const html = taxon.cached_html || taxon.cached || taxon.name || otu?.object_tag || otu?.name || ''
    if (html && !taxaByName.has(nameId)) {
      taxaByName.set(nameId, {
        id: taxon.id,
        otuId: otu?.id || null,
        html,
        key: `taxon-${nameId}`
      })
    }
  }

  // Preserve linked taxa that do not have a source citation directly attached
  // to their TaxonName record, while preferring the source-cited name above.
  for (const otu of otus) {
    const nameId = String(otu.taxon_name_id || otu.id)
    if (!taxaByName.has(nameId)) {
      taxaByName.set(nameId, {
        id: otu.taxon_name_id,
        otuId: otu.id,
        html: otu.object_tag || otu.name || '',
        key: `taxon-${nameId}`
      })
    }
  }
  const taxa = [...taxaByName.values()]
    .sort((a, b) => a.html.localeCompare(b.html))

  const nomenclaturalActs = taxonNames
    .map((taxon) => {
      const otu = otuByTaxonName.get(String(taxon.id))
      return {
        id: taxon.id,
        otuId: otu?.id || null,
        html: taxon.cached_html || taxon.cached || taxon.name,
        rank: taxon.rank || '',
        year: taxon.year_of_publication || taxon.year || null,
        pages: taxon.pages
      }
    })
    .sort((a, b) => String(a.html).localeCompare(String(b.html)))

  const nameById = new Map(taxonNames.map((taxon) => [String(taxon.id), taxon]))
  const relationshipNameIds = [...new Set(relationships.flatMap((item) => [item.subject_taxon_name_id, item.object_taxon_name_id]).filter(Boolean).map(String))]
  const missingNameIds = relationshipNameIds.filter((id) => !nameById.has(id))
  const relatedNameResults = await Promise.allSettled(missingNameIds.map((id) => makeAPIRequest.get(`/taxon_names/${id}`)))
  relatedNameResults.forEach((result) => {
    if (result.status === 'fulfilled') nameById.set(String(result.value.data.id), result.value.data)
  })

  const rankOrder = ['kingdom', 'phylum', 'subphylum', 'class', 'subclass', 'order', 'suborder', 'superfamily', 'family', 'subfamily', 'tribe', 'subtribe', 'genus', 'subgenus', 'species', 'subspecies']
  const rankOf = (nameId) => String(nameById.get(String(nameId))?.rank || '').split('::').pop().toLowerCase()
  const rankIndex = (rank) => rankOrder.indexOf(rank)
  const synonymizations = []
  const rankChanges = []
  const otherRelationships = []
  for (const relationship of relationships) {
    const kind = String(relationship.type || '').split('::').slice(1).join(' ')
    const relationText = `${relationship.type || ''} ${relationship.subject_status_tag || ''} ${relationship.object_status_tag || ''}`.toLowerCase()
    const subjectRank = rankOf(relationship.subject_taxon_name_id)
    const objectRank = rankOf(relationship.object_taxon_name_id)
    const subjectIndex = rankIndex(subjectRank)
    const objectIndex = rankIndex(objectRank)
    const isSynonym = /synonym/.test(relationText)
    const rankDiffers = subjectIndex >= 0 && objectIndex >= 0 && subjectRank !== objectRank
    const isTypification = /typification|unavailable|homonym|misspelling/.test(relationText)
    const record = {
      id: relationship.id,
      pages: relationship.pages,
      kind: kind || 'Nomenclatural relationship',
      subject: relationship.subject_name || nameById.get(String(relationship.subject_taxon_name_id))?.cached || 'Taxon name',
      object: relationship.object_name || nameById.get(String(relationship.object_taxon_name_id))?.cached || 'Taxon name',
      subjectStatus: relationship.subject_status_tag || '',
      objectStatus: relationship.object_status_tag || '',
      subjectRank,
      objectRank
    }
    if (isSynonym) synonymizations.push(record)
    else if (rankDiffers && !isTypification) {
      record.direction = subjectIndex > objectIndex ? 'Promoted' : 'Demoted'
      rankChanges.push(record)
    } else otherRelationships.push(record)
  }

  const newSpecies = nomenclaturalActs.filter((act) => act.rank === 'species')
  const newGenera = nomenclaturalActs.filter((act) => act.rank === 'genus')
  const otherNomenclaturalActs = nomenclaturalActs.filter((act) => !['species', 'genus'].includes(act.rank))

  const specimenPoints = specimens
    .map((specimen) => ({
      id: specimen.id,
      lat: numberOrNaN(specimen.decimalLatitude),
      lng: numberOrNaN(specimen.decimalLongitude),
      name: specimen.scientificName || 'Specimen',
      locality: [specimen.locality, specimen.stateProvince, specimen.country].filter(Boolean).join(', '),
      date: specimen.eventDate || '',
      otuId: specimen.otu_id || null,
      institutionCode: specimen.institutionCode || '',
      catalogNumber: specimen.catalogNumber || '',
      recordedBy: specimen.recordedBy || '',
      typeStatus: specimen.typeStatus || '',
      pages: specimen.pages || ''
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))

  return {
    source,
    citationCount: citationRecords.length,
    taxa,
    nomenclaturalActs,
    newSpecies,
    newGenera,
    otherNomenclaturalActs,
    synonymizations,
    rankChanges,
    otherRelationships,
    specimens,
    images,
    specimenPoints,
    distributionCount: distributionCitations.length,
    distributionAreaCount: distributionAreas.length,
    distributionFeatures: distributionAreas
  }
}

export async function fetchSourceCitationCounts(sourceIds) {
  const ids = [...new Set(sourceIds.filter(Boolean).map(String))]
  const counts = new Map()
  const concurrency = 10
  for (let offset = 0; offset < ids.length; offset += concurrency) {
    const batch = ids.slice(offset, offset + concurrency)
    await Promise.all(batch.map(async (id) => {
      try {
        const { headers, data } = await makeAPIRequest.get('/citations', { params: { source_id: id, per: 1 } })
        counts.set(id, Number(headers?.['pagination-total']) || data?.length || 0)
      } catch {
        counts.set(id, 0)
      }
    }))
  }
  return counts
}
