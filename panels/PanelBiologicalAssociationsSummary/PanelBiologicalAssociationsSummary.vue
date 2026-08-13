<template>
  <VCard>
    <ClientOnly>
      <VSpinner v-if="isLoading" />
    </ClientOnly>

    <VCardHeader>
      Biological Associations
      <span v-if="totalAssociations">
        ({{ totalAssociations }})
      </span>
    </VCardHeader>

    <VCardContent class="min-h-[6rem] overflow-x-auto">
      <!-- Controls -->
      <div class="flex flex-wrap gap-6 items-center mb-4">
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

/*
 * Fields for the endpoint being displayed.
 * ADDED: otuId fields to extract associated OTUs from collection objects.
 */
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

/*
 * Determine which associations belong to the selected direction.
 * UPDATED: Uses the extracted OtuId to cleanly filter collection objects.
 */
const directedAssociations = computed(() => {
  const currentOtuId = Number(props.otuId)

  return biologicalAssociations.value.filter(association => {
    if (selectedDirection.value === 'object') {
      const subjectId = Number(association.subjectId)
      // Check for camelCased property from makeBiologicalAssociation or raw snake_case fallback
      const subjectOtuId = Number(association.subjectOtuId || association.subject_otu_id)

      if (subjectId === currentOtuId || subjectOtuId === currentOtuId) {
        return true
      }
      
      // Allow purely unidentified collection objects through if necessary
      if (association.subjectType === 'CollectionObject' && !subjectOtuId) {
        return true
      }
      return false
    }

    // Subject direction
    const objectId = Number(association.objectId)
    const objectOtuId = Number(association.objectOtuId || association.object_otu_id)

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

/*
 * Build the summary table.
 * UPDATED: Aggregates CollectionObjects by their effective OTU ID.
 */
const summaryRows = computed(() => {
  const groups = new Map()
  const fields = currentSideFields.value

  for (const association of directedAssociations.value) {
    const endpointId = association[fields.id]
    const endpointType = association[fields.type]
    
    // Safely extract the OTU ID linked to this endpoint (crucial for CollectionObjects)
    const endpointOtuId = association[fields.otuId] || association[`${selectedDirection.value}_otu_id`]

    let label = association[fields[selectedRank.value]]
    let displayLabel = label

    if (!displayLabel) {
      displayLabel = association[selectedDirection.value === 'object' ? 'objectLabel' : 'subjectLabel']
    }

    if (!displayLabel) continue

    // Determine the true OTU ID for grouping purposes
    const effectiveOtuId = endpointType === 'Otu' ? endpointId : (endpointOtuId || null)

    let key
    if (effectiveOtuId && selectedRank.value === 'species') {
      // Group by OTU ID, meaning CollectionObjects and Otus of the same species combine
      key = `otu:${effectiveOtuId}`
    } else if (endpointType === 'CollectionObject') {
      key = `collection-object:${endpointId || displayLabel}`
    } else if (selectedRank.value === 'species') {
      key = `${endpointId || ''}:${displayLabel}`
    } else {
      key = displayLabel
    }

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: displayLabel,
        otuId: effectiveOtuId,
        endpointType, 
        counts: {},
        total: 0
      })
    }

    const row = groups.get(key)

    // Upgrade the group's label if an actual Otu is encountered. 
    // This replaces a generic "CollectionObject..." label with the actual species name!
    if (endpointType === 'Otu' && row.endpointType !== 'Otu') {
      row.label = displayLabel
      row.endpointType = 'Otu'
    } else if (row.endpointType !== 'Otu' && displayLabel.startsWith('CollectionObject')) {
      // Fallback: If no Otu record exists in this group, try to use genus text
      const genusText = association[fields.genus]
      if (genusText) {
        row.label = `${genusText} sp.`
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

    const firstItems = firstResponse.data.map(makeBiologicalAssociation)
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
        allItems.push(...response.data.map(makeBiologicalAssociation))
      }
    }

    biologicalAssociations.value = allItems
    totalAssociations.value = allItems.length
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