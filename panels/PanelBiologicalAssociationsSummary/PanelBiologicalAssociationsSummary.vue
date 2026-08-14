<template>
  <VCard>
    <ClientOnly>
      <VSpinner v-if="isLoading" />
    </ClientOnly>

    <VCardHeader>
      Biological Associations summary
      <span v-if="totalAssociations">
        ({{ totalAssociations }})
      </span>
    </VCardHeader>

    <VCardContent class="min-h-[6rem] overflow-x-auto">
      <!-- Controls -->
      <div class="flex flex-wrap gap-6 items-center mb-4">
        <!-- Taxonomic level -->
        <div class="flex items-center gap-2">
          <label
            for="association-rank"
            class="font-medium"
          >
            Taxonomic level:
          </label>

          <select
            id="association-rank"
            v-model="selectedRank"
            class="border rounded px-2 py-1 bg-base-background"
          >
            <option value="species">Species</option>
            <option value="genus">Genus</option>
            <option value="family">Family</option>
          </select>
        </div>
		
		<!-- Object / Subject switch -->
        <div class="flex items-center gap-2">
          <span class="font-medium">
            Relationship direction:
          </span>

          <div class="inline-flex border rounded overflow-hidden">
            <button
              type="button"
              @click="selectedDirection = 'object'"
              class="px-3 py-1 border-r"
              :class="
                selectedDirection === 'object'
                  ? 'bg-gray-300 font-semibold'
                  : 'bg-base-background hover:bg-gray-100'
              "
            >
              Object
            </button>

            <button
              type="button"
              @click="selectedDirection = 'subject'"
              class="px-3 py-1"
              :class="
                selectedDirection === 'subject'
                  ? 'bg-gray-300 font-semibold'
                  : 'bg-base-background hover:bg-gray-100'
              "
            >
              Subject
            </button>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div
        v-if="isLoading"
        class="text-center my-8"
      >
        Loading biological associations...
      </div>

      <!-- Summary table -->
      <div
        v-else-if="summaryRows.length"
        class="w-full"
      >
        <VTable>
          <VTableHeader class="normal-case">
            <VTableHeaderRow>
              <VTableHeaderCell>
                {{ rankLabel }}
              </VTableHeaderCell>

              <VTableHeaderCell
                v-for="relationship in relationships"
                :key="relationship"
                class="text-center"
              >
                {{ relationship }}
              </VTableHeaderCell>

              <VTableHeaderCell
                class="text-center border-l-2"
              >
                Total
              </VTableHeaderCell>
            </VTableHeaderRow>
          </VTableHeader>

          <VTableBody>
            <VTableBodyRow
              v-for="row in summaryRows"
              :key="row.key"
            >
              <!-- Taxon / endpoint -->
              <VTableBodyCell>
                <!-- Species OTU -->
                <RouterLink
                  v-if="row.otuId && row.endpointType === 'Otu'"
                  :to="{
                    name: 'otus-id',
                    params: {
                      id: row.otuId
                    }
                  }"
                  v-html="row.label"
                />

                <!-- Collection object or other endpoint -->
                <span
                  v-else
                  v-html="row.label"
                />
              </VTableBodyCell>

              <!-- Relationship counts -->
              <VTableBodyCell
                v-for="relationship in relationships"
                :key="relationship"
                class="text-center"
              >
                {{ row.counts[relationship] || 0 }}
              </VTableBodyCell>

              <!-- Total -->
              <VTableBodyCell
                class="text-center font-semibold border-l-2"
              >
                {{ row.total }}
              </VTableBodyCell>
            </VTableBodyRow>
          </VTableBody>
        </VTable>
      </div>

      <!-- No records -->
      <div
        v-else-if="!isLoading"
        class="text-xl text-center my-8 w-full"
      >
        No biological association records found.
      </div>
    </VCardContent>
  </VCard>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { makeAPIRequest } from '@/utils'
import { makeBiologicalAssociation } from '../PanelBiologicalAssociations/utils/makeBiologicalAssociation.js'

const props = defineProps({
  otuId: {
    type: Number,
    required: true
  }
})

const selectedDirection = ref('object')
const selectedRank = ref('species')
const biologicalAssociations = ref([])
const isLoading = ref(false)
const totalAssociations = ref(0)
const perPage = 50

// New ref to dynamically store missing OTU names fetched from the API
const fetchedOtuLabels = ref({})

const sideFields = {
  object: {
    id: 'objectId',
    otuId: 'objectOtuId',
    type: 'objectType',
    species: 'objectLabel',
    genus: 'objectGenus',
    family: 'objectFamily'
  },
  subject: {
    id: 'subjectId',
    otuId: 'subjectOtuId',
    type: 'subjectType',
    species: 'subjectLabel',
    genus: 'subjectGenus',
    family: 'subjectFamily'
  }
}

const rankLabel = computed(() => {
  switch (selectedRank.value) {
    case 'family':
      return 'Family'
    case 'genus':
      return 'Genus'
    case 'species':
    default:
      return 'Species'
  }
})

const currentSideFields = computed(() => {
  return sideFields[selectedDirection.value]
})

const directedAssociations = computed(() => {
  const currentOtuId = Number(props.otuId)

  return biologicalAssociations.value.filter(association => {
    if (selectedDirection.value === 'object') {
      const subjectId = Number(association.subjectId)
      const subjectOtuId = Number(association.subjectOtuId)

      if (subjectId === currentOtuId || subjectOtuId === currentOtuId) {
        return true
      }
      
      if (association.subjectType === 'CollectionObject' && !subjectOtuId) {
        return true
      }
      return false
    }

    const objectId = Number(association.objectId)
    const objectOtuId = Number(association.objectOtuId)

    if (objectId === currentOtuId || objectOtuId === currentOtuId) {
      return true
    }
    
    if (association.objectType === 'CollectionObject' && !objectOtuId) {
      return true
    }

    return false
  })
})

const relationships = computed(() => {
  return [
    ...new Set(
      directedAssociations.value
        .map(association => association.biologicalRelationship)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b))
})

const summaryRows = computed(() => {
  const groups = new Map()
  const fields = currentSideFields.value

  for (const association of directedAssociations.value) {
    const endpointId = association[fields.id]
    const endpointType = association[fields.type]
    const endpointOtuId = association[fields.otuId]

    let displayLabel

    if (selectedRank.value === 'species') {
      // Prioritize the deep-extracted name (which includes subspecies)
      displayLabel = association[selectedDirection.value === 'object' ? 'objectExtractedName' : 'subjectExtractedName']
                  || association[fields.species]
                  || association[selectedDirection.value === 'object' ? 'objectLabel' : 'subjectLabel']
    } else {
      displayLabel = association[fields[selectedRank.value]]
                  || association[selectedDirection.value === 'object' ? 'objectLabel' : 'subjectLabel']
    }

    if (!displayLabel) continue

    const effectiveOtuId = endpointType === 'Otu' ? endpointId : (endpointOtuId || null)
    let key

    if (selectedRank.value === 'species') {
      if (effectiveOtuId) {
        key = `otu:${effectiveOtuId}`
      } else {
        // Group by the name string if OTU ID is missing so identical subspecies collapse together
        key = `name:${displayLabel}`
      }
    } else {
      key = displayLabel
    }

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: displayLabel,
        otuId: selectedRank.value === 'species' ? effectiveOtuId : null,
        endpointType: selectedRank.value === 'species' ? endpointType : null, 
        counts: {},
        total: 0
      })
    }

    const row = groups.get(key)

    if (selectedRank.value === 'species') {
      if (endpointType === 'Otu' && row.endpointType !== 'Otu') {
        // Upgrade from explicit OTU record
        row.label = displayLabel
        row.endpointType = 'Otu'
      } else if (row.endpointType !== 'Otu') {
        // Look up the name dynamically if we fetched it
        if (effectiveOtuId && fetchedOtuLabels.value[effectiveOtuId]) {
          row.label = fetchedOtuLabels.value[effectiveOtuId]
          row.endpointType = 'Otu' 
        } else if (displayLabel.startsWith('CollectionObject')) {
          const genusText = association[fields.genus]
          if (genusText) {
            row.label = `${genusText} sp.`
          }
        }
      }
    }

    const relationship = association.biologicalRelationship
    if (!relationship) continue

    if (!row.counts[relationship]) {
      row.counts[relationship] = 0
    }

    row.counts[relationship] += 1
    row.total += 1
  }

  return [...groups.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    return a.label.localeCompare(b.label)
  })
})

// Utility functions to deep-extract subspecies/species names for Collection Objects
function getTaxonFromTaxonomy(taxonomy) {
  if (!taxonomy) return null
  return taxonomy.subspecies || taxonomy.species || taxonomy.genus
}

function extractTaxonName(endpoint, taxonomyExt) {
  if (!endpoint) return null
  if (endpoint.type === 'Otu') return endpoint.object_tag || endpoint.name
  
  // Prefer the explicit taxonomy object if provided
  const taxName = getTaxonFromTaxonomy(taxonomyExt) || getTaxonFromTaxonomy(endpoint.taxonomy)
  if (taxName) return taxName

  // Fallback: extract the scientific name from TaxonWorks object_tag parenthesis
  if (endpoint.object_tag && endpoint.object_tag.includes('(')) {
    const match = endpoint.object_tag.match(/\(([^)]+)\)/)
    if (match) {
      return match[1]
    }
  }
  return null
}

const processItem = (item) => ({
  ...makeBiologicalAssociation(item),
  subjectOtuId: item.subject_otu_id || item.subject?.otu_id,
  objectOtuId: item.object_otu_id || item.object?.otu_id,
  subjectExtractedName: extractTaxonName(item.subject, item.subject_taxonomy),
  objectExtractedName: extractTaxonName(item.object, item.object_taxonomy)
})

async function fetchMissingOtuLabels(allItems) {
  const explicitOtuIds = new Set()
  const allOtuIds = new Set()

  for (const item of allItems) {
    if (item.subjectOtuId) allOtuIds.add(Number(item.subjectOtuId))
    if (item.objectOtuId) allOtuIds.add(Number(item.objectOtuId))

    if (item.subjectType === 'Otu' && item.subjectId) {
      explicitOtuIds.add(Number(item.subjectId))
    }
    if (item.objectType === 'Otu' && item.objectId) {
      explicitOtuIds.add(Number(item.objectId))
    }
  }

  const idsToFetch = Array.from(allOtuIds).filter(id => !explicitOtuIds.has(id))
  
  if (!idsToFetch.length) return

  const chunkSize = 50
  for (let i = 0; i < idsToFetch.length; i += chunkSize) {
    const chunk = idsToFetch.slice(i, i + chunkSize)
    try {
      const query = chunk.map(id => `otu_id[]=${id}`).join('&')
      const response = await makeAPIRequest.get(`/otus.json?${query}`)
      
      const newLabels = { ...fetchedOtuLabels.value }
      response.data.forEach(otu => {
        newLabels[otu.id] = otu.object_tag || otu.name
      })
      fetchedOtuLabels.value = newLabels
    } catch (error) {
      console.error('Failed to fetch missing OTU labels:', error)
    }
  }
}

async function loadBiologicalAssociations() {
  isLoading.value = true
  biologicalAssociations.value = []
  totalAssociations.value = 0

  try {
    const extend = [
      'object',
      'subject',
      'biological_relationship',
      'taxonomy',
      'biological_relationship_types'
    ]

    const firstResponse = await makeAPIRequest.get(
      '/biological_associations/basic',
      {
        params: {
          'otu_query[coordinatify]': true,
          'otu_query[otu_id][]': props.otuId,
          per: perPage,
          page: 1,
          extend
        }
      }
    )

    const firstItems = firstResponse.data.map(processItem)
    const total = Number(firstResponse.headers['pagination-total'] || firstItems.length)
    const allItems = [...firstItems]
    const totalPages = Math.ceil(total / perPage)

    if (totalPages > 1) {
      for (let page = 2; page <= totalPages; page++) {
        const response = await makeAPIRequest.get(
          '/biological_associations/basic',
          {
            params: {
              'otu_query[coordinatify]': true,
              'otu_query[otu_id][]': props.otuId,
              per: perPage,
              page,
              extend
            }
          }
        )
        allItems.push(...response.data.map(processItem))
      }
    }

    biologicalAssociations.value = allItems
    totalAssociations.value = allItems.length
    fetchMissingOtuLabels(allItems)

  } catch (error) {
    console.error('Error loading biological associations:', error)
    biologicalAssociations.value = []
    totalAssociations.value = 0
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadBiologicalAssociations()
})
</script>