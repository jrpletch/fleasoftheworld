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
            <option value="species">
              Species
            </option>

            <option value="genus">
              Genus
            </option>

            <option value="family">
              Family
            </option>
          </select>
        </div>
      </div>

      <!-- Loading message -->
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

              <!-- Taxon -->
              <VTableHeaderCell>
                {{ rankLabel }}
              </VTableHeaderCell>

              <!-- Relationship columns -->
              <VTableHeaderCell
                v-for="relationship in relationships"
                :key="relationship"
                class="text-center"
              >
                {{ relationship }}
              </VTableHeaderCell>

              <!-- Total -->
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

              <!-- Taxon name -->
              <VTableBodyCell>
                <RouterLink
                  v-if="
                    selectedRank === 'species' &&
                    row.otuId
                  "
                  :to="{
                    name: 'otus-id',
                    params: {
                      id: row.otuId
                    }
                  }"
                  v-html="row.label"
                />

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

      <!-- No results -->
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
import {
  computed,
  onMounted,
  ref,
  watch
} from 'vue'

import { makeAPIRequest } from '@/utils'

import { makeBiologicalAssociation } from '../PanelBiologicalAssociations/utils/makeBiologicalAssociation.js'


const props = defineProps({
  otuId: {
    type: Number,
    required: true
  }
})


/*
 * Which side of the biological association
 * should be summarized?
 *
 * Object:
 *
 *   Current OTU
 *       |
 *       | relationship
 *       v
 *   Object OTU
 *
 *
 * Subject:
 *
 *   Subject OTU
 *       |
 *       | relationship
 *       v
 *   Current OTU
 */
const selectedDirection = ref('object')


/*
 * Taxonomic level used to group the
 * associated taxa.
 */
const selectedRank = ref('species')


/*
 * All biological association records
 * returned by the API.
 */
const biologicalAssociations = ref([])


/*
 * Loading state.
 */
const isLoading = ref(false)


/*
 * Number of association records returned
 * by the API.
 */
const totalAssociations = ref(0)


/*
 * Number of records requested per page.
 */
const perPage = 100


/*
 * Fields corresponding to each side of
 * the biological association.
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
 * Label for the first table column.
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
 * Get the appropriate fields for the
 * selected direction.
 */
const currentSideFields = computed(() => {
  return sideFields[
    selectedDirection.value
  ]
})


/*
 * Find every unique biological relationship
 * represented in the current set of records.
 *
 * These become the table columns.
 */
const relationships = computed(() => {
  return [
    ...new Set(
      biologicalAssociations.value
        .map(
          association =>
            association.biologicalRelationship
        )
        .filter(Boolean)
    )
  ].sort((a, b) =>
    a.localeCompare(b)
  )
})


/*
 * Generate the summary table.
 */
const summaryRows = computed(() => {
  const groups = new Map()

  const fields =
    currentSideFields.value

  for (
    const association
    of biologicalAssociations.value
  ) {

    /*
     * Get the name at the selected
     * taxonomic level.
     */
    const label =
      association[
        fields[selectedRank.value]
      ]

    /*
     * Ignore records where the selected
     * taxonomic information isn't available.
     */
    if (!label) {
      continue
    }


    /*
     * Species are grouped using the OTU ID
     * plus the label.
     *
     * Genus and family are grouped by name.
     */
    const key =
      selectedRank.value === 'species'
        ? `${association[fields.id] || ''}:${label}`
        : label


    /*
     * Create a new row if necessary.
     */
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,

        /*
         * Keep the OTU ID so that species
         * can link to their TaxonPages page.
         */
        otuId:
          selectedRank.value === 'species'
            ? association[fields.id]
            : null,

        /*
         * Relationship-specific counts.
         */
        counts: {},

        /*
         * Total count across all relationships.
         */
        total: 0
      })
    }


    const row = groups.get(key)


    /*
     * Get the biological relationship.
     */
    const relationship =
      association.biologicalRelationship


    if (!relationship) {
      continue
    }


    /*
     * Initialize relationship count.
     */
    if (
      !row.counts[relationship]
    ) {
      row.counts[relationship] = 0
    }


    /*
     * Increment relationship count.
     */
    row.counts[relationship] += 1


    /*
     * Increment total.
     */
    row.total += 1
  }


  /*
   * Sort:
   *
   * 1. Highest total first
   * 2. Alphabetically when totals match
   */
  return [...groups.values()].sort(
    (a, b) => {

      if (b.total !== a.total) {
        return b.total - a.total
      }

      return a.label.localeCompare(
        b.label
      )
    }
  )
})


/*
 * Load biological associations involving
 * the CURRENT OTU.
 */
async function loadAllBiologicalAssociations() {
  isLoading.value = true

  biologicalAssociations.value = []
  totalAssociations.value = 0


  try {

    /*
     * Common API parameters.
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
     * OBJECT MODE
     *
     * We want:
     *
     *     current OTU
     *          |
     *          v
     *       OBJECT
     *
     * Therefore the current OTU must be
     * the SUBJECT of the association.
     *
     * We explicitly constrain:
     *
     * biological_association_subject_id
     * biological_association_subject_type
     */
    if (
      selectedDirection.value ===
      'object'
    ) {

      params[
        'biological_association_subject_id[]'
      ] = [props.otuId]

      params[
        'biological_association_subject_type'
      ] = 'Otu'
    }


    /*
     * SUBJECT MODE
     *
     * We want:
     *
     *       SUBJECT
     *          |
     *          v
     *     current OTU
     *
     * Therefore the current OTU must be
     * the OBJECT of the association.
     *
     * We explicitly constrain:
     *
     * biological_association_object_id
     * biological_association_object_type
     */
    else {

      params[
        'biological_association_object_id[]'
      ] = [props.otuId]

      params[
        'biological_association_object_type'
      ] = 'Otu'
    }


    /*
     * Request the first page.
     */
    const firstResponse =
      await makeAPIRequest.get(
        '/biological_associations/basic',
        {
          params
        }
      )


    /*
     * Convert API records using the same
     * helper as the existing biological
     * associations panel.
     */
    const firstItems =
      firstResponse.data.map(
        makeBiologicalAssociation
      )


    /*
     * Get the total number of matching
     * records.
     */
    const total = Number(
      firstResponse.headers[
        'pagination-total'
      ] ||
      firstItems.length
    )


    totalAssociations.value =
      total


    /*
     * Calculate number of pages.
     */
    const totalPages =
      Math.ceil(
        total / perPage
      )


    /*
     * Start with the first page.
     */
    const allItems = [
      ...firstItems
    ]


    /*
     * Retrieve remaining pages.
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
        await Promise.all(
          requests
        )


      for (
        const response
        of responses
      ) {

        allItems.push(
          ...response.data.map(
            makeBiologicalAssociation
          )
        )
      }
    }


    /*
     * Store all matching associations.
     *
     * summaryRows automatically recomputes.
     */
    biologicalAssociations.value =
      allItems

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
 * When Object / Subject is changed,
 * reload the associations using the
 * opposite side of the current OTU.
 */
watch(
  selectedDirection,
  () => {
    loadAllBiologicalAssociations()
  }
)


/*
 * Initial load.
 */
onMounted(() => {
  loadAllBiologicalAssociations()
})
</script>