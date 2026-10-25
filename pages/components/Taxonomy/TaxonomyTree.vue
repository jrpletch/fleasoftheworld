<template>
  <section class="rounded-2xl bg-base-foreground ring-1 ring-base-border/40 p-5 text-sm">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="text-base font-semibold text-base-content">{{ title }}</h2>
      <button
        v-if="root && !loading"
        type="button"
        class="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-base-content/60 hover:bg-base-muted/50 hover:text-base-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary"
        :aria-label="copyState === 'copied' ? 'Tree copied to clipboard' : 'Copy tree to clipboard'"
        :title="copyState === 'copied' ? 'Copied' : 'Copy tree to clipboard'"
        @click="copyVisibleTree"
      >
        <IconCheck
          v-if="copyState === 'copied'"
          class="h-4 w-4"
        />
        <IconClipboard
          v-else
          class="h-4 w-4"
        />
      </button>
    </div>
    <p
      v-if="loading && !root"
      class="text-base-content/50"
    >
      Loading…
    </p>
    <p
      v-else-if="!root && !loading"
      class="text-base-content/60"
    >
      No records found.
    </p>
    <p
      v-if="root && loadingExpanded"
      class="mb-2 text-xs text-base-content/55"
      aria-live="polite"
    >
      Building tree…
    </p>
    <ul
      v-if="root"
      ref="treeEl"
    >
      <TaxonomyTreeNode
        :key="`${props.otuId}-${props.expandThrough}-${props.path.join('.')}`"
        :node="root"
        :path="relativePath"
        default-open
      />
    </ul>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef, toRef, watch } from 'vue'
import { makeAPIRequest } from '@/utils/request'
import TaxonomyTreeNode from './TaxonomyTreeNode.vue'

const MAX_TREE_DEPTH = 9
const LOOKUP_BATCH_SIZE = 150
const MAX_CONCURRENT_BATCHES = 3
const EXPANSION_STAGES = {
  everything: [1, 3, 5, MAX_TREE_DEPTH],
  family: [1, 3],
  genus: [1, 3, 6]
}
const taxonomyStageCache = new Map()
const rankCache = new Map()

const props = defineProps({
  otuId: { type: [String, Number], required: true },
  title: { type: String, default: '' },
  // Full ancestor chain (root to taxon) of OTU ids to expand.
  path: { type: Array, default: () => [] },
  showInvalid: { type: Boolean, default: true },
  expandThrough: { type: String, default: '' },
  resetVersion: { type: Number, default: 0 }
})
const emit = defineEmits(['expansion-change'])

provide('showInvalid', toRef(props, 'showInvalid'))
provide('expandThrough', toRef(props, 'expandThrough'))
provide('resetTreeVersion', toRef(props, 'resetVersion'))
provide('trackTreeOverride', (nodeId, isOverride) =>
  emit('expansion-change', `${props.otuId}:${nodeId}`, isOverride)
)

const root = shallowRef(null)
const loading = ref(true)
const loadingExpanded = ref(false)
provide('treeBuilding', loadingExpanded)
const treeEl = ref(null)
const copyState = ref('idle')
let copyResetTimer

const relativePath = computed(() => {
  const i = props.path.indexOf(Number(props.otuId))
  return i >= 0 ? props.path.slice(i) : []
})

function serializeVisibleTree() {
  const lines = []

  function visitNode(item, depth) {
    const link = item.querySelector(':scope > div > a')
    if (!link) return

    lines.push(`${'\t'.repeat(depth)}${link.textContent.trim()}`)

    for (const childList of Array.from(item.children).filter((child) => child.tagName === 'UL')) {
      const taxa = Array.from(childList.children).filter((child) => child.querySelector(':scope > div > a'))
      if (taxa.length) {
        for (const child of taxa) visitNode(child, depth + 1)
      } else if (props.showInvalid) {
        for (const synonym of childList.children) {
          lines.push(`${'\t'.repeat(depth + 1)}${synonym.textContent.trim()}`)
        }
      }
    }
  }

  if (treeEl.value) {
    for (const item of Array.from(treeEl.value.children)) visitNode(item, 0)
  }

  return lines.join('\n')
}

async function copyVisibleTree() {
  try {
    await navigator.clipboard.writeText(serializeVisibleTree())
    copyState.value = 'copied'
    clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => (copyState.value = 'idle'), 2000)
  } catch {
    copyState.value = 'error'
    clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => (copyState.value = 'idle'), 3000)
  }
}

function flattenNodes(node, output = []) {
  output.push(node)
  for (const child of Array.isArray(node.descendants) ? node.descendants : []) {
    flattenNodes(child, output)
  }
  return output
}

function chunks(items, size) {
  const output = []
  for (let i = 0; i < items.length; i += size) output.push(items.slice(i, i + size))
  return output
}

async function fetchChunks(items, fetchChunk) {
  const output = []
  const batches = chunks(items, LOOKUP_BATCH_SIZE)
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
    output.push(...await Promise.all(batches.slice(i, i + MAX_CONCURRENT_BATCHES).map(fetchChunk)))
  }
  return output
}

async function loadRanks(nodes) {
  const missing = nodes.filter((node) => !rankCache.has(node.otu_id))
  const otuResponses = await fetchChunks(
    missing.map((node) => node.otu_id),
    (ids) => makeAPIRequest.get('/otus.json', {
      params: { otu_id: ids, per: ids.length, extend: ['taxon_name'] }
    })
  )
  const ranks = new Map()
  for (const { data } of otuResponses) {
    for (const otu of data) {
      rankCache.set(otu.id, String(otu.taxon_name?.rank || '').toLowerCase())
    }
  }
  for (const node of nodes) ranks.set(node.otu_id, rankCache.get(node.otu_id) || '')
  return ranks
}

const RANK_LEVEL = {
  domain: 0,
  kingdom: 1,
  subkingdom: 2,
  phylum: 3,
  subphylum: 4,
  class: 5,
  subclass: 6,
  infraclass: 7,
  superorder: 8,
  order: 9,
  suborder: 10,
  infraorder: 11,
  parvorder: 12,
  superfamily: 13,
  family: 14,
  subfamily: 15,
  tribe: 16,
  subtribe: 17,
  genus: 18,
  subgenus: 19,
  species: 20,
  subspecies: 21
}

function addCounts(node, ranks, expandThrough) {
  let species = 0
  let subspecies = 0
  const children = Array.isArray(node.descendants) ? node.descendants : []
  const descendants = children.map((child) => {
    const counted = addCounts(child, ranks, expandThrough)
    species += counted.species
    subspecies += counted.subspecies
    return counted.node
  })
  const rank = ranks.get(node.otu_id)
  if (rank === 'species') species += 1
  if (rank === 'subspecies') subspecies += 1
  const autoOpen = expandThrough === 'everything' || (
    expandThrough &&
    expandThrough !== 'everything' &&
    RANK_LEVEL[rank] !== undefined &&
    RANK_LEVEL[rank] < RANK_LEVEL[expandThrough]
  )
  return {
    species,
    subspecies,
    node: {
      ...node,
      display_rank: rank,
      species_count: species,
      subspecies_count: subspecies,
      expand_open: autoOpen,
      descendants
    }
  }
}

function getTaxonomyAtDepth(otuId, depth) {
  const key = `${Number(otuId)}:${depth}`
  if (!taxonomyStageCache.has(key)) {
    const request = makeAPIRequest
      .get(`/otus/${Number(otuId)}/inventory/taxonomy.json`, {
        params: { max_descendants_depth: depth }
      })
      .then(({ data }) => (data && Object.keys(data).length ? data : null))
      .catch((error) => {
        taxonomyStageCache.delete(key)
        throw error
      })
    taxonomyStageCache.set(key, request)
  }
  return taxonomyStageCache.get(key)
}

let loadGeneration = 0
async function loadTree() {
  const generation = ++loadGeneration
  loading.value = true
  loadingExpanded.value = false
  try {
    const stages = EXPANSION_STAGES[props.expandThrough]
    if (stages) {
      loadingExpanded.value = true
      for (const depth of stages) {
        const data = await getTaxonomyAtDepth(props.otuId, depth)
        if (generation !== loadGeneration) return
        if (!data) break
        const ranks = await loadRanks(flattenNodes(data))
        if (generation !== loadGeneration) return
        root.value = addCounts(data, ranks, props.expandThrough).node
        loading.value = false
      }
      return
    }

    const data = await getTaxonomyAtDepth(props.otuId, 1)
    if (generation !== loadGeneration) return
    root.value = data
  } catch {
    if (generation === loadGeneration && !root.value) root.value = null
  } finally {
    if (generation === loadGeneration) {
      loading.value = false
      loadingExpanded.value = false
    }
  }
}

onMounted(loadTree)
watch(() => [props.otuId, props.expandThrough], loadTree)
onBeforeUnmount(() => clearTimeout(copyResetTimer))
</script>
