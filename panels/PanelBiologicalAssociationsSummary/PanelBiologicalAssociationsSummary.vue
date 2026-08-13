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

      <!-- Summary table -->
      <div
        v-if="summaryRows.length"
        class="w-full"
      >
        <VTable>
          <VTableHeader class="normal-case">
            <VTableHeaderRow>
              <!-- Taxon column -->
              <VTableHeaderCell>
                {{ rankLabel }}
              </VTableHeaderCell>

              <!-- Biological relationship columns -->
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
              <!-- Taxon -->
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
        v-if="
          !isLoading &&
          !summaryRows.length
        "
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
 * Which side of the biological association should
 * be displayed?
 *
 * Object:
 *
 *   Current taxon
 *        |
 *        | relationship
 *        v
 *   Object taxon
 *
 * Subject:
 *
 *   Subject taxon
 *        |
 *        | relationship
 *        v
 *   Current taxon
 */
const selectedDirection = ref('object')

/*
 * Taxonomic level used to group the associated taxa.
 */
const selectedRank = ref('species')

/*
 * All biological association records returned
 * from the API.
 */
const biologicalAssociations = ref([])

/*
 * Loading state.
 */
const isLoading = ref(false)

/*
 * Total number of biological association records.
 */
const totalAssociations = ref(0)

/*
 * Number of records requested per API page.
 */
const perPage = 100

/*
 * Fields used for each side of a biological
 * association.
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
 * Label used for the first table column.
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
 * Fields corresponding to the side selected
 * by the user.
 */
const currentSideFields = computed(() => {
  return sideFields[selectedDirection.value]
})

/*
 * Find every unique biological relationship
 * represented in the records.
 *
 * These become the table columns.
 *
 * For example:
 *
 * collected from
 * collected from nest
 * parasitizes
 * infects
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
  ].sort((a, b) =>
    a.localeCompare(b)
  )
})

/*
 * Build the summarized rows.
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
     * Determine which taxonomic name to use.
     *
     * Examples:
     *
     * Object + Species
     *   -> objectLabel
     *
     * Object + Genus
     *   -> objectGenus
     *
     * Subject + Species
     *   -> subjectLabel
     */
    const label =
      association[
        fields[selectedRank.value]
      ]

    /*
     * Ignore associations where the selected
     * taxonomic information isn't available.
     */
    if (!label) {
      continue
    }

    /*
     * Species are grouped by OTU ID and name.
     *
     * This prevents two different OTUs with the
     * same label from accidentally being combined.
     *
     * Genus and family are grouped by their name.
     */
    const key =
      selectedRank.value === 'species'
        ? `${association[fields.id] || ''}:${label}`
        : label

    /*
     * Create the row the first time we encounter
     * this taxon.
     */
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,

        /*
         * Store the OTU ID so that species names
         * can link to their TaxonPages page.
         */
        otuId:
          selectedRank.value === 'species'
            ? association[fields.id]
            : null,

        /*
         * Counts for each relationship.
         *
         * Example:
         *
         * {
         *   'collected from': 12,
         *   'collected from nest': 4
         * }
         */
        counts: {},

        /*
         * Total number of associations for this
         * taxon.
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
     * Initialize this relationship's count.
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
   * Sort by total number of records.
   *
   * Highest total first.
   *
   * Alphabetical name is used as the secondary
   * sort when totals are equal.
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
 * Load all biological associations for the
 * currently selected direction.
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
     * IMPORTANT:
     *
     * If the user wants to see OBJECTS,
     * the current taxon must be the SUBJECT.
     *
     * If the user wants to see SUBJECTS,
     * the current taxon must be the OBJECT.
     */

    if (
      selectedDirection.value ===
      'object'
    ) {
      params[
        'subject_otu_query[otu_id][]'
      ] = props.otuId
    } else {
      params[
        'object_otu_query[otu_id][]'
      ] = props.otuId
    }

    /*
     * Get the first page.
     */
    const firstResponse =
      await makeAPIRequest.get(
        '/biological_associations/basic',
        {
          params
        }
      )

    const firstItems =
      firstResponse.data.map(
        makeBiologicalAssociation
      )

    /*
     * Determine the total number of
     * association records.
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
     * Determine how many pages we need.
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
     * Fetch all remaining pages.
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
     * Store all records.
     *
     * summaryRows will automatically
     * recompute.
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
 * When the user switches between Object
 * and Subject, we need to make a new API
 * request because we're asking TaxonWorks
 * for associations on the opposite side.
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