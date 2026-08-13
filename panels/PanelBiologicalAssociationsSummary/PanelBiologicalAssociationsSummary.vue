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

import { makeBiologicalAssociation } from '../PanelBiologicalAssociations/utils/makeBiologicalAssociation.js'


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
 * All associations involving the current OTU.
 *
 * IMPORTANT:
 *
 * These are already scoped by the API using:
 *
 *   otu_query[otu_id][] = props.otuId
 *
 * We then determine whether the current OTU is
 * the subject or object in JavaScript.
 */
const biologicalAssociations = ref([])


const isLoading = ref(false)


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
  return sideFields[
    selectedDirection.value
  ]
})


/*
 * Determine which biological relationships
 * occur in the currently selected direction.
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
 * Build the summary table.
 */
const summaryRows = computed(() => {
  const groups = new Map()

  const fields =
    currentSideFields.value


  /*
   * First restrict the records to the appropriate
   * direction.
   *
   * OBJECT:
   *
   *   Current OTU is the SUBJECT
   *   We display the OBJECT.
   *
   * SUBJECT:
   *
   *   Current OTU is the OBJECT
   *   We display the SUBJECT.
   */
  const directedAssociations =
    biologicalAssociations.value.filter(
      association => {

        if (
          selectedDirection.value ===
          'object'
        ) {
          return (
            Number(association.subjectId) ===
            Number(props.otuId)
          )
        }

        return (
          Number(association.objectId) ===
          Number(props.otuId)
        )
      }
    )


  /*
   * Aggregate the directed associations.
   */
  for (
    const association
    of directedAssociations
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
     * Subject + Species:
     *   subjectLabel
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
     * Create row.
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
 * Load ALL biological associations involving
 * the current OTU.
 *
 * This intentionally uses the SAME query as
 * your existing working panel:
 *
 *   otu_query[otu_id][]: props.otuId
 *
 * That query correctly scopes the results.
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
     * First request.
     *
     * This is deliberately based on the
     * existing working panel.
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
     * Convert the API response.
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


    totalAssociations.value =
      total


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
     * Fetch the remaining pages.
     *
     * Every request continues to use
     * otu_query[otu_id][] so every record
     * is scoped to the current OTU.
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
     * Store all associations involving
     * this OTU.
     */
    biologicalAssociations.value =
      allItems

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