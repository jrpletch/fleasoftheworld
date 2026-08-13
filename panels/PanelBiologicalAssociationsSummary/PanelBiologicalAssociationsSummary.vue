<template>
  <VCard>
    <ClientOnly>
      <VSpinner v-if="isLoading" />
    </ClientOnly>

    <VCardHeader>
      Biological associations
      <span v-if="totalAssociations">
        ({{ totalAssociations }})
      </span>
    </VCardHeader>

    <VCardContent class="min-h-[6rem] overflow-x-auto">
      <!-- Controls -->
      <div class="flex flex-wrap gap-4 items-center mb-4">
        <!-- Relationship direction -->
        <div class="flex items-center gap-2">
          <label for="association-direction" class="font-medium">
            Direction:
          </label>

          <select
            id="association-direction"
            v-model="selectedDirection"
            class="border rounded px-2 py-1 bg-base-background"
          >
            <option value="object">Object</option>
            <option value="subject">Subject</option>
          </select>
        </div>

        <!-- Taxonomic level -->
        <div class="flex items-center gap-2">
          <label for="association-rank" class="font-medium">
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

      <!-- Summary table -->
      <div v-if="summaryRows.length" class="w-full">
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
                <!-- Species can link directly to the associated OTU -->
                <template
                  v-if="
                    selectedRank === 'species' &&
                    row.otuId
                  "
                >
                  <RouterLink
                    :to="{
                      name: 'otus-id',
                      params: { id: row.otuId }
                    }"
                    v-html="row.label"
                  />
                </template>

                <!-- Genus and family -->
                <template v-else>
                  <span v-html="row.label" />
                </template>
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

      <!-- No results -->
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
import { computed, onMounted, ref, watch } from 'vue'
import { makeAPIRequest } from '@/utils'
import { makeBiologicalAssociation } from '../PanelBiologicalAssociations/utils/makeBiologicalAssociation.js'

const props = defineProps({
  otuId: {
    type: Number,
    required: true
  }
})

/*
 * The user can switch between the two sides of a
 * biological association.
 *
 * object:
 *   Current taxon -> biological relationship -> associated taxon
 *
 * subject:
 *   Associated taxon -> biological relationship -> current taxon
 */
const selectedDirection = ref('object')

/*
 * Taxonomic level used to aggregate the associated taxa.
 */
const selectedRank = ref('species')

const biologicalAssociations = ref([])
const isLoading = ref(false)
const totalAssociations = ref(0)

const perPage = 100

/*
 * Fields in the API response corresponding to each
 * side of the biological association.
 */
const sideFields = {
  object: {
    id: 'objectId',
    species: 'objectLabel',
    genus: 'objectGenus',
    family: 'objectFamily'
  },

  subject: {
    id: 'subjectId',
    species: 'subjectLabel',
    genus: 'subjectGenus',
    family: 'subjectFamily'
  }
}

/*
 * Label displayed above the first column.
 */
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

/*
 * Get the fields corresponding to the selected
 * subject/object direction.
 */
const currentSideFields = computed(() => {
  return sideFields[selectedDirection.value]
})

/*
 * Get all unique biological relationships represented
 * in the records.
 *
 * These become the table columns.
 */
const relationships = computed(() => {
  return [
    ...new Set(
      biologicalAssociations.value
        .map(
          (association) =>
            association.biologicalRelationship
        )
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b))
})

/*
 * Generate the summary table.
 *
 * Every row represents a taxon on the selected side
 * of the biological association.
 */
const summaryRows = computed(() => {
  const groups = new Map()

  const fields = currentSideFields.value

  for (const association of biologicalAssociations.value) {
    /*
     * Get the appropriate name based on the selected
     * taxonomic level.
     */
    const label =
      association[fields[selectedRank.value]]

    if (!label) {
      continue
    }

    /*
     * Species are grouped by OTU ID + label.
     *
     * Genus and family are grouped by their taxonomic
     * name.
     */
    const key =
      selectedRank.value === 'species'
        ? `${association[fields.id] || ''}:${label}`
        : label

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        otuId:
          selectedRank.value === 'species'
            ? association[fields.id]
            : null,
        counts: {},
        total: 0
      })
    }

    const row = groups.get(key)

    const relationship =
      association.biologicalRelationship

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
   * Sort by total number of records, highest first.
   *
   * Alphabetical ordering is used as the secondary sort
   * when two taxa have the same total.
   */
  return [...groups.values()].sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total
    }

    return a.label.localeCompare(b.label)
  })
})

/*
 * Load all biological associations.
 *
 * We need every record because the purpose of this
 * panel is to calculate totals rather than display
 * individual paginated records.
 */
async function loadAllBiologicalAssociations() {
  isLoading.value = true
  biologicalAssociations.value = []
  totalAssociations.value = 0

  try {
    /*
     * Build the query according to the selected
     * subject/object direction.
     */
    const params = {
      per: perPage,
      page: 1,
      extend: [
        'object',
        'subject',
        'biological_relationship',
        'taxonomy',
        'biological_relationship_types'
      ]
    }

    /*
     * If the current taxon is the SUBJECT, we want
     * associations whose subject is the current OTU.
     *
     * If the current taxon is the OBJECT, we want
     * associations whose object is the current OTU.
     */
    if (selectedDirection.value === 'object') {
      params['subject_otu_query[otu_id][]'] =
        props.otuId
    } else {
      params['object_otu_query[otu_id][]'] =
        props.otuId
    }

    /*
     * First request.
     */
    const firstResponse =
      await makeAPIRequest.get(
        '/biological_associations/basic',
        { params }
      )

    const firstItems =
      firstResponse.data.map(
        makeBiologicalAssociation
      )

    /*
     * Get the total number of records from the
     * pagination response header.
     */
    const total = Number(
      firstResponse.headers['pagination-total'] ||
        firstItems.length
    )

    totalAssociations.value = total

    const totalPages = Math.ceil(
      total / perPage
    )

    const allItems = [...firstItems]

    /*
     * Fetch remaining pages.
     */
    if (totalPages > 1) {
      const requests = []

      for (
        let page = 2;
        page <= totalPages;
        page++
      ) {
        requests.push(
          makeAPIRequest.get(
            '/biological_associations/basic',
            {
              params: {
                ...params,
                page
              }
            }
          )
        )
      }

      const responses =
        await Promise.all(requests)

      for (const response of responses) {
        allItems.push(
          ...response.data.map(
            makeBiologicalAssociation
          )
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

/*
 * Changing Object <-> Subject requires another API query,
 * because we're asking TaxonWorks for the opposite side
 * of the current taxon.
 */
watch(selectedDirection, () => {
  loadAllBiologicalAssociations()
})

onMounted(() => {
  loadAllBiologicalAssociations()
})
</script>