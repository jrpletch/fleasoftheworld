<template>
  <VCard>
    <ClientOnly>
      <VSpinner v-if="isLoading" />
    </ClientOnly>

    <VCardHeader>
      Biological associations summary
      <span v-if="totalAssociations">
        ({{ totalAssociations }})
      </span>
    </VCardHeader>

    <VCardContent class="min-h-[6rem] overflow-x-auto">
      <div v-if="summaryRows.length" class="w-full">
        <VTable>
          <VTableHeader class="normal-case">
            <VTableHeaderRow>
              <VTableHeaderCell>
                <select
                  v-model="selectedRank"
                  class="border rounded px-2 py-1 bg-base-background"
                >
                  <option value="species">Species</option>
                  <option value="genus">Genus</option>
                  <option value="family">Family</option>
                </select>
              </VTableHeaderCell>

              <VTableHeaderCell
                v-for="relationship in relationships"
                :key="relationship"
                class="text-center"
              >
                {{ relationship }}
              </VTableHeaderCell>

              <VTableHeaderCell class="text-center border-l-2">
                Total
              </VTableHeaderCell>
            </VTableHeaderRow>
          </VTableHeader>

          <VTableBody>
            <VTableBodyRow
              v-for="row in summaryRows"
              :key="row.key"
            >
              <VTableBodyCell>
                <template v-if="selectedRank === 'species' && row.otuId">
                  <RouterLink
                    :to="{
                      name: 'otus-id',
                      params: { id: row.otuId }
                    }"
                    v-html="row.label"
                  />
                </template>

                <template v-else>
                  <span v-html="row.label" />
                </template>
              </VTableBodyCell>

              <VTableBodyCell
                v-for="relationship in relationships"
                :key="relationship"
                class="text-center"
              >
                {{ row.counts[relationship] || 0 }}
              </VTableBodyCell>

              <VTableBodyCell
                class="text-center font-semibold border-l-2"
              >
                {{ row.total }}
              </VTableBodyCell>
            </VTableBodyRow>
          </VTableBody>
        </VTable>
      </div>

      <div
        v-if="!isLoading && !summaryRows.length"
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

const extend = [
  'object',
  'subject',
  'biological_relationship',
  'taxonomy',
  'biological_relationship_types'
]

const biologicalAssociations = ref([])
const isLoading = ref(false)
const totalAssociations = ref(0)

const selectedRank = ref('species')

/*
 * The API is paginated. We use a reasonably large page size and
 * retrieve every page before generating the summary.
 */
const perPage = 100

/*
 * Get the unique biological relationships represented by the
 * associations for this taxon.
 *
 * Sorting alphabetically makes the columns predictable.
 */
const relationships = computed(() => {
  return [...new Set(
    biologicalAssociations.value
      .map((association) => association.biologicalRelationship)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b))
})

/*
 * Return the taxonomic name to use for an association based
 * on the currently selected rank.
 */
function getRankValue(association) {
  switch (selectedRank.value) {
    case 'family':
      return association.objectFamily

    case 'genus':
      return association.objectGenus

    case 'species':
    default:
      return association.objectLabel
  }
}

/*
 * Build the summary table.
 *
 * Each row represents one host taxon.
 *
 * Example:
 *
 * {
 *   key: 'Oryctolagus cuniculus',
 *   label: 'Oryctolagus cuniculus',
 *   otuId: 1234,
 *   counts: {
 *     'collected from': 12,
 *     'collected from nest': 4
 *   },
 *   total: 16
 * }
 */
const summaryRows = computed(() => {
  const groups = new Map()

  for (const association of biologicalAssociations.value) {
    const label = getRankValue(association)

    if (!label) {
      continue
    }

    /*
     * For species we use the OTU ID when available.
     * For genus/family, the taxon name is sufficient for grouping.
     */
    const key =
      selectedRank.value === 'species'
        ? `${association.objectId || ''}:${label}`
        : label

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        otuId:
          selectedRank.value === 'species'
            ? association.objectId
            : null,
        counts: {},
        total: 0
      })
    }

    const row = groups.get(key)
    const relationship = association.biologicalRelationship

    if (!relationship) {
      continue
    }

    if (!row.counts[relationship]) {
      row.counts[relationship] = 0
    }

    row.counts[relationship] += 1
    row.total += 1
  }

  /*
   * Most records first.
   *
   * If two taxa have the same number of records,
   * sort them alphabetically as a secondary sort.
   */
  return [...groups.values()].sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total
    }

    return a.label.localeCompare(b.label)
  })
})

onMounted(() => {
  loadAllBiologicalAssociations()
})

async function loadAllBiologicalAssociations() {
  isLoading.value = true
  biologicalAssociations.value = []

  try {
    /*
     * First request tells us how many records exist.
     */
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

    const firstItems = firstResponse.data.map(
      makeBiologicalAssociation
    )

    const total = Number(
      firstResponse.headers['pagination-total'] ||
      firstItems.length
    )

    totalAssociations.value = total

    /*
     * Determine how many pages are required.
     */
    const totalPages = Math.ceil(total / perPage)

    const allItems = [...firstItems]

    /*
     * Fetch remaining pages.
     */
    if (totalPages > 1) {
      const requests = []

      for (let page = 2; page <= totalPages; page++) {
        requests.push(
          makeAPIRequest.get(
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
        )
      }

      const responses = await Promise.all(requests)

      for (const response of responses) {
        allItems.push(
          ...response.data.map(makeBiologicalAssociation)
        )
      }
    }

    biologicalAssociations.value = allItems
  } catch (error) {
    console.error(
      'Error loading biological association summary:',
      error
    )

    biologicalAssociations.value = []
    totalAssociations.value = 0
  } finally {
    isLoading.value = false
  }
}
</script>