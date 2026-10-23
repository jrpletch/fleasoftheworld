<template>
  <li class="relative">
    <div
      ref="rowEl"
      class="flex items-center gap-1 rounded py-0.5 pr-2"
      :class="highlighted ? 'bg-secondary/15 ring-1 ring-secondary/50' : ''"
    >
      <button
        v-if="!node.leaf_node"
        type="button"
        class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-base-content/60 hover:bg-base-muted/50"
        :aria-expanded="isOpen"
        aria-label="Toggle descendants"
        @click="isOpen = !isOpen"
      >
        <svg
          class="h-3.5 w-3.5 transition-transform"
          :class="isOpen ? 'rotate-90' : ''"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m9 5 7 7-7 7"
          />
        </svg>
      </button>
      <span
        v-else
        class="w-5 flex-shrink-0"
      />
      <RouterLink
        class="text-secondary hover:underline [&_i]:italic"
        :to="{ name: 'otus-id', params: { id: node.otu_id } }"
        v-html="node.name"
      />
      <span
        v-if="speciesCount !== null"
        class="ml-1 flex-shrink-0 whitespace-nowrap text-xs tabular-nums text-base-content/55"
      >
        {{ speciesCount.n.toLocaleString('en-US') }} {{ speciesCount.unit }}
      </span>
    </div>

    <ul
      v-if="showInvalid && node.nomenclatural_synonyms?.length"
      class="ml-8 pb-1 text-base-content/70"
    >
      <li
        v-for="synonym in node.nomenclatural_synonyms"
        :key="synonym"
      >
        <span class="mr-1 text-orange-500">=</span>
        <span v-html="synonym" />
      </li>
    </ul>

    <ul
      v-if="isOpen"
      class="ml-2.5 border-l border-base-border/60 pl-3"
    >
      <li
        v-if="loading"
        class="py-1 text-base-content/50"
      >
        Loading…
      </li>
      <TaxonomyTreeNode
        v-for="child in children"
        :key="child.otu_id"
        :node="child"
        :path="childPath(child)"
      />
    </ul>
  </li>
</template>

<script>
import { makeAPIRequest } from '@/utils/request'

const SPECIES_RANK = 'NomenclaturalRank::Iczn::SpeciesGroup::Species'
const SUBSPECIES_RANK = 'NomenclaturalRank::Iczn::SpeciesGroup::Subspecies'
const countCache = new Map()

const countRank = (taxonNameId, rank) =>
  makeAPIRequest
    .get('/taxon_names', {
      params: { taxon_name_id: [taxonNameId], descendants: true, validity: true, rank: [rank], per: 1 }
    })
    .then(({ headers }) => Number(headers['pagination-total']) || 0)

// Valid species below the OTU's taxon name, or subspecies when there are no species.
function fetchCount(otuId) {
  if (!countCache.has(otuId)) {
    countCache.set(
      otuId,
      makeAPIRequest
        .get(`/otus/${otuId}`)
        .then(async ({ data: otu }) => {
          const species = await countRank(otu.taxon_name_id, SPECIES_RANK)
          if (species) return { n: species, unit: 'species' }
          const subspecies = await countRank(otu.taxon_name_id, SUBSPECIES_RANK)
          return subspecies ? { n: subspecies, unit: 'subspecies' } : null
        })
        .catch(() => null)
    )
  }
  return countCache.get(otuId)
}
</script>

<script setup>
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  node: { type: Object, required: true },
  // Remaining OTU ids to expand, starting at this node; the last id is the highlighted taxon.
  path: { type: Array, default: () => [] },
  defaultOpen: { type: Boolean, default: false }
})

const rowEl = ref(null)
const showInvalid = inject('showInvalid', ref(true))
const speciesCount = ref(null)
const isOpen = ref(props.defaultOpen)
const children = ref([...(props.node.descendants || [])])
const loading = ref(false)

const highlighted = computed(() => props.path.length === 1 && props.path[0] === props.node.otu_id)

async function loadChildren() {
  if (children.value.length || props.node.leaf_node) return
  loading.value = true
  try {
    const { data } = await makeAPIRequest.get(`/otus/${props.node.otu_id}/inventory/taxonomy.json`, {
      params: { max_descendants_depth: 1 }
    })
    children.value = data.descendants || []
  } catch {
    children.value = []
  } finally {
    loading.value = false
  }
}

const childPath = (child) =>
  props.path.length > 1 && props.path[0] === props.node.otu_id && props.path[1] === child.otu_id
    ? props.path.slice(1)
    : []

watch(isOpen, (open) => open && loadChildren(), { immediate: true })

onMounted(async () => {
  if (props.node.leaf_node) return
  speciesCount.value = await fetchCount(props.node.otu_id)
})

watch(
  () => props.path,
  (p) => {
    if (p.length > 1 && p[0] === props.node.otu_id) isOpen.value = true
  },
  { immediate: true }
)

watch(
  highlighted,
  async (on) => {
    if (!on) return
    await nextTick()
    rowEl.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  },
  { immediate: true }
)
</script>
