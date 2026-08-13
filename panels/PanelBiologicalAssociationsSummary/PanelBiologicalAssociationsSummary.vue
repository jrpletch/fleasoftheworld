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

              <!-- Taxon -->
              <VTableHeaderCell>
                {{ rankLabel }}
              </VTableHeaderCell>

              <!-- Biological relationships -->
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

                <!-- Link species to its OTU page -->
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

                <!-- Genus / Family -->
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
import {
  computed,
  onMounted,
  ref
} from 'vue'

import { makeAPIRequest } from '@/utils'

import {
  makeBiologicalAssociation
} from '../PanelBiologicalAssociations/utils/makeBiologicalAssociation.js'


const props = defineProps({
  otuId: {
    type: Number,
    required: true
  }
})


/*
 * Which side of the association do we want
 * to summarize?
 *
 * Object:
 *
 *   Current OTU
 *       |
 *       | relationship
 *       v
 *   Object taxon
 *
 * Subject:
 *
 *   Subject taxon
 *       |
 *       | relationship
 *       v
 *   Current OTU
 */
const selectedDirection = ref('object')


/*
 * Taxonomic level used for grouping.
 */
const selectedRank = ref('species')


/*
 * Associations involving the current OTU.
 *
 * IMPORTANT:
 *
 * The API request is scoped using:
 *
 *   otu_query[otu_id][] = props.otuId
 *
 * We ALSO explicitly filter the returned records
 * below so that this array can never contain an
 * association where the current OTU is neither
 * the subject nor the object.
 */
const biologicalAssociations = ref([])


const isLoading = ref(false)


/*
 * Number of association records involving
 * the current OTU.
 */
const totalAssociations = ref(0)


/*
 * Number of records requested per API page.
 */
const perPage = 50


/*
 * Fields for the side of the association
 * that we are displaying.
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
 * Fields for the side currently being summarized.
 */
const currentSideFields = computed(() => {
  return sideFields[selectedDirection.value]
})


/*
 * Explicitly determine which associations belong
 * to the selected direction.
 *
 * Object:
 *
 *   Current OTU = SUBJECT
 *   Display OBJECT
 *
 * Subject:
 *
 *   Current OTU = OBJECT
 *   Display SUBJECT
 *
 * This computed property is deliberately based
 * on biologicalAssociations, which has already
 * been explicitly scoped to the current OTU.
 */
const directedAssociations = computed(() => {
  const currentOtuId = Number(props.otuId)

  return biologicalAssociations.value.filter(
    association => {

      if (
        selectedDirection.value === 'object'
      ) {
        return (
          Number(association.subjectId) ===
          currentOtuId
        )
      }

      return (
        Number(association.objectId) ===
        currentOtuId
      )
    }
  )
})


/*
 * Determine which biological relationships occur
 * in the currently selected direction.
 *
 * IMPORTANT:
 *
 * This uses directedAssociations rather than
 * biologicalAssociations.
 *
 * Therefore relationship columns cannot be
 * introduced by associations from the opposite
 * direction.
 */
const relationships = computed(() => {
  return [
    ...new Set(
      directedAssociations.value
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
 * Build the summary table.
 */
const summaryRows = computed(() => {
  const groups = new Map()

  const fields =
    currentSideFields.value


  /*
   * Aggregate the already directionally scoped
   * associations.
   */
  for (
    const association
    of directedAssociations.value
  ) {

    /*
     * Get the appropriate taxonomic field.
     *
     * Object + Species:
     *   objectLabel
     *
     * Object + Genus:
     *   objectGenus
     *
     * Object + Family:
     *   objectFamily
     *
     * Subject + Species:
     *   subjectLabel
     *
     * Subject + Genus:
     *   subjectGenus
     *
     * Subject + Family:
     *   subjectFamily
     */
    const label =
      association[
        fields[selectedRank.value]
      ]


    /*
     * Skip associations that don't have
     * the selected taxonomic information.
     */
    if (!label) {
      continue
    }


    /*
     * Species are grouped by OTU ID and label.
     *
     * Genus and Family are grouped by name.
     */
    const key =
      selectedRank.value === 'species'
        ? `${association[fields.id] || ''}:${label}`
        : label


    /*
     * Create a new summary row if necessary.
     */
    if (!groups.has(key)) {

      groups.set(key, {
        key,
        label,

        /*
         * Save OTU ID so species can link
         * to their TaxonPages page.
         */
        otuId:
          selectedRank.value === 'species'
            ? association[fields.id]
            : null,

        counts: {},

        total: 0
      })
    }


    const row = groups.get(key)


    /*
     * Biological relationship.
     */
    const relationship =
      association.biologicalRelationship


    /*
     * Ignore records without a relationship.
     */
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
   * Sort by total records, highest first.
   *
   * Alphabetical name is the secondary sort.
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
 * the current OTU.
 */
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


    /*
     * The API request is still explicitly scoped
     * using the current OTU.
     */
    const firstResponse =
      await makeAPIRequest.get(
        '/biological_associations/basic',
        {
          params: {
            'otu_query[coordinatify]': true,

            'otu_query[otu_id][]':
              props.otuId,

            per: perPage,

            page: 1,

            extend
          }
        }
      )


    /*
     * Convert the first page of API records.
     */
    const firstItems =
      firstResponse.data.map(
        makeBiologicalAssociation
      )


    /*
     * Read pagination information.
     */
    const total = Number(
      firstResponse.headers[
        'pagination-total'
      ] ||
      firstItems.length
    )


    /*
     * Calculate the number of pages.
     */
    const totalPages =
      Math.ceil(
        total / perPage
      )


    /*
     * Start with page 1.
     */
    const allItems = [
      ...firstItems
    ]


    /*
     * Fetch all remaining pages.
     *
     * Every request continues to include
     * the current OTU query.
     */
    if (totalPages > 1) {

      for (
        let page = 2;
        page <= totalPages;
        page++
      ) {

        const response =
          await makeAPIRequest.get(
            '/biological_associations/basic',
            {
              params: {
                'otu_query[coordinatify]':
                  true,

                'otu_query[otu_id][]':
                  props.otuId,

                per: perPage,

                page,

                extend
              }
            }
          )


        allItems.push(
          ...response.data.map(
            makeBiologicalAssociation
          )
        )
      }
    }


    /*
     * DEFENSIVE CURRENT-OTU FILTER
     *
     * Even if the API query accidentally returns
     * associations outside the current OTU, only
     * retain records where the current OTU occurs
     * on either side of the association.
     */
    const currentOtuId =
      Number(props.otuId)


    const scopedItems =
      allItems.filter(
        association => {

          const subjectId =
            Number(association.subjectId)

          const objectId =
            Number(association.objectId)


          return (
            subjectId === currentOtuId ||
            objectId === currentOtuId
          )
        }
      )


    /*
     * Store ONLY associations involving
     * the current OTU.
     */
    biologicalAssociations.value =
      scopedItems


    /*
     * The displayed total should reflect the
     * records that actually survived the explicit
     * current-OTU filter.
     */
    totalAssociations.value =
      scopedItems.length

  } catch (error) {

    console.error(
      'Error loading biological associations:',
      error
    )

    biologicalAssociations.value = []

    totalAssociations.value = 0

  } finally {

    isLoading.value = false
  }
}


/*
 * Initial load.
 */
onMounted(() => {
  loadBiologicalAssociations()
})
</script>