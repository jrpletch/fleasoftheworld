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
                  v-if="
                    row.otuId &&
                    row.endpointType === 'Otu'
                  "
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
 * Direction of the relationship.
 *
 * Object:
 *
 *   Current OTU
 *       |
 *       | relationship
 *       v
 *   Object
 *
 * Subject:
 *
 *   Subject
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
 * Biological associations returned by TaxonWorks.
 *
 * IMPORTANT:
 *
 * We DO NOT perform a second ID-based filter here.
 *
 * TaxonWorks':
 *
 *   otu_query[otu_id][] = props.otuId
 *
 * is responsible for finding associations involving
 * the current OTU.
 *
 * This is important because an endpoint can be a
 * CollectionObject rather than the OTU itself.
 */
const biologicalAssociations = ref([])


const isLoading = ref(false)


/*
 * Number of associations returned by the
 * current-OTU query.
 */
const totalAssociations = ref(0)


/*
 * API page size.
 */
const perPage = 50


/*
 * Fields for the endpoint being displayed.
 */
const sideFields = {
  object: {
    id: 'objectId',
    type: 'objectType',
    species: 'objectLabel',
    genus: 'objectGenus',
    family: 'objectFamily'
  },

  subject: {
    id: 'subjectId',
    type: 'subjectType',
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
 * Fields for the endpoint currently being displayed.
 */
const currentSideFields = computed(() => {
  return sideFields[
    selectedDirection.value
  ]
})


/*
 * Determine which associations belong to the
 * selected direction.
 *
 * IMPORTANT:
 *
 * This is NOT checking whether the endpoint ID
 * equals props.otuId.
 *
 * Instead, we use the type of the endpoint and
 * the relationship returned by TaxonWorks.
 *
 * For a normal OTU-to-OTU association:
 *
 * Object mode:
 *   current OTU is subject
 *
 * Subject mode:
 *   current OTU is object
 *
 * CollectionObjects are allowed through because
 * the otu_query has already established their
 * connection to the current OTU.
 */
const directedAssociations = computed(() => {
  const currentOtuId = Number(props.otuId)

  return biologicalAssociations.value.filter(
    association => {

      /*
       * If the selected endpoint itself is the
       * current OTU, use the direct ID relationship.
       */
      if (
        selectedDirection.value === 'object'
      ) {

        if (
          Number(association.subjectId) ===
          currentOtuId
        ) {
          return true
        }

        /*
         * A CollectionObject can be associated
         * with the current OTU through its
         * identification. Do not discard it here.
         */
        if (
          association.subjectType ===
          'CollectionObject'
        ) {
          return true
        }

        return false
      }


      /*
       * Subject direction.
       */
      if (
        Number(association.objectId) ===
        currentOtuId
      ) {
        return true
      }


      /*
       * Preserve CollectionObject records.
       *
       * TaxonWorks has already scoped these records
       * using otu_query[otu_id][].
       */
      if (
        association.objectType ===
        'CollectionObject'
      ) {
        return true
      }


      return false
    }
  )
})


/*
 * Biological relationship types that occur in
 * the selected direction.
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


  for (
    const association
    of directedAssociations.value
  ) {

    /*
     * Get the endpoint information.
     */
    const endpointId =
      association[fields.id]

    const endpointType =
      association[fields.type]

    const label =
      association[
        fields[selectedRank.value]
      ]


    /*
     * If we have taxonomic information for this
     * endpoint, use it.
     *
     * For a normal OTU:
     *
     * species -> species label
     * genus   -> genus
     * family  -> family
     *
     * For a CollectionObject, these fields may
     * not exist. In that case we fall back to
     * the endpoint label.
     */
    let displayLabel = label


    if (!displayLabel) {
      displayLabel =
        association[
          selectedDirection.value === 'object'
            ? 'objectLabel'
            : 'subjectLabel'
        ]
    }


    /*
     * Do not discard CollectionObjects simply
     * because they lack genus/family information.
     */
    if (!displayLabel) {
      continue
    }


    /*
     * Determine how the record should be grouped.
     *
     * Normal OTUs:
     *
     *   Species = OTU ID + label
     *   Genus   = genus name
     *   Family  = family name
     *
     * CollectionObjects:
     *
     *   They are grouped by their endpoint label
     *   rather than being treated as an OTU.
     */
    let key

    if (
      endpointType === 'CollectionObject'
    ) {

      key =
        `collection-object:${endpointId || displayLabel}`

    } else if (
      selectedRank.value === 'species'
    ) {

      key =
        `${endpointId || ''}:${displayLabel}`

    } else {

      key = displayLabel
    }


    /*
     * Create row.
     */
    if (!groups.has(key)) {

      groups.set(key, {
        key,

        label: displayLabel,

        /*
         * Only actual OTUs get a TaxonPages link.
         */
        otuId:
          endpointType === 'Otu'
            ? endpointId
            : null,

        endpointType,

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
   * Sort by number of records.
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
     * First API request.
     *
     * This is the important scoping operation.
     *
     * TaxonWorks determines which associations
     * involve the current OTU.
     */
    const firstResponse =
      await makeAPIRequest.get(
        '/biological_associations/basic',
        {
          params: {
            'otu_query[coordinatify]':
              true,

            'otu_query[otu_id][]':
              props.otuId,

            per: perPage,

            page: 1,

            extend
          }
        }
      )


    /*
     * Convert API records into the normalized
     * biological-association structure.
     */
    const firstItems =
      firstResponse.data.map(
        makeBiologicalAssociation
      )


    /*
     * Pagination total from TaxonWorks.
     */
    const total = Number(
      firstResponse.headers[
        'pagination-total'
      ] ||
      firstItems.length
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
     * IMPORTANT:
     *
     * Every page retains the same:
     *
     *   otu_query[otu_id][]
     *
     * parameter.
     */
    const totalPages =
      Math.ceil(
        total / perPage
      )


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
     * IMPORTANT:
     *
     * Do NOT filter allItems using:
     *
     *   subjectId === props.otuId
     *
     * or:
     *
     *   objectId === props.otuId
     *
     * because CollectionObjects can be the actual
     * association endpoint while their identification
     * is what connects them to the current OTU.
     */
    biologicalAssociations.value =
      allItems


    /*
     * This is the number of associations returned
     * by the current-OTU query.
     */
    totalAssociations.value =
      allItems.length

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