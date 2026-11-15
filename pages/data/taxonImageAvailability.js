import { makeAPIRequest } from '@/utils/request'

const rankRequests = new Map()
const imageRequests = new Map()
const photoSummaryRequests = new Map()

const RANK_LEVEL = {
  family: 14,
  subfamily: 15,
  tribe: 16,
  subtribe: 17,
  genus: 18,
  subgenus: 19,
  species: 20
}

export function getTaxonRank(otuId) {
  const key = String(otuId)
  if (!rankRequests.has(key)) {
    rankRequests.set(
      key,
      makeAPIRequest
        .get(`/otus/${key}`, { params: { extend: ['taxon_name'] } })
        .then(({ data }) => String(data.taxon_name?.rank || '').toLowerCase())
        .catch(() => '')
    )
  }
  return rankRequests.get(key)
}

export async function hasSpeciesImages(otuId, rank = '') {
  const key = String(otuId)
  const taxonRank = String(rank || await getTaxonRank(key)).toLowerCase()
  if (taxonRank !== 'species') return false

  if (!imageRequests.has(key)) {
    imageRequests.set(
      key,
      makeAPIRequest
        .get(`/otus/${key}/inventory/images.json`, {
          params: {
            otu_scope: ['all', 'coordinate_otus'],
            sort_order: []
          }
        })
        .then(({ data }) => Boolean(data.image_order?.some(Boolean)))
        .catch(() => false)
    )
  }
  return imageRequests.get(key)
}

function flattenTaxonomy(node, output = []) {
  if (!node) return output
  output.push(node)
  for (const child of node.descendants || []) flattenTaxonomy(child, output)
  return output
}

async function loadRanks(otuIds) {
  const ranks = new Map()
  for (let offset = 0; offset < otuIds.length; offset += 150) {
    const ids = otuIds.slice(offset, offset + 150)
    try {
      const { data } = await makeAPIRequest.get('/otus.json', {
        params: { otu_id: ids, per: ids.length, extend: ['taxon_name'] }
      })
      for (const otu of data || []) {
        ranks.set(String(otu.id), String(otu.taxon_name?.rank || '').toLowerCase())
      }
    } catch {
      // A failed batch leaves unknown ranks out of the photo count.
    }
  }
  return ranks
}

export function getTaxonPhotoSummary(otuId) {
  const key = String(otuId)
  if (!photoSummaryRequests.has(key)) {
    const request = (async () => {
      const rank = await getTaxonRank(key)
      const level = RANK_LEVEL[rank]
      if (level === undefined || level < RANK_LEVEL.family || level >= RANK_LEVEL.species) {
        return null
      }

      try {
        const { data } = await makeAPIRequest.get(`/otus/${key}/inventory/taxonomy.json`, {
          params: { max_descendants_depth: 9 }
        })
        const nodes = flattenTaxonomy(data)
        const ranks = await loadRanks(nodes.map((node) => node.otu_id))
        const speciesIds = nodes
          .filter((node) => ranks.get(String(node.otu_id)) === 'species')
          .map((node) => node.otu_id)

        let photographed = 0
        for (let offset = 0; offset < speciesIds.length; offset += 8) {
          const batch = speciesIds.slice(offset, offset + 8)
          const results = await Promise.all(batch.map((id) => hasSpeciesImages(id, 'species')))
          photographed += results.filter(Boolean).length
        }
        return { photographed, total: speciesIds.length }
      } catch {
        return { photographed: 0, total: 0 }
      }
    })()
    photoSummaryRequests.set(key, request)
  }
  return photoSummaryRequests.get(key)
}
