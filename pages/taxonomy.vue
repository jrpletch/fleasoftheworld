<template>
  <div class="h-full">
    <SectionLandscape />
    <SectionData />
    <SectionDescription />	
	<div class="max-w-screen-2xl mx-auto px-6 my-12">
		<div class="flex flex-col md:flex-row md:items-start gap-4 mb-6">
		  <div class="w-full md:max-w-2xl md:flex-1">
			<GlobalSearch
			  taxa-only
			  variant="page"
			  placeholder="Find a taxon in the tree, e.g. Xenopsylla cheopis"
			  @select-taxon="revealTaxon"
			/>
			<div
			  class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2"
			>
			  <label
				v-show="view === 'browse'"
				class="inline-flex cursor-pointer select-none items-center gap-1.5 text-xs text-base-content/70"
			  >
				<input
				  v-model="showInvalid"
				  type="checkbox"
				  class="h-3.5 w-3.5 accent-secondary"
				/>
				Show invalid names
			  </label>
			  <label
				v-show="view === 'browse'"
				class="inline-flex items-center gap-1.5 text-xs text-base-content/70"
			  >
				Show
				<select
				  v-model="activeExpandThrough"
				  @change="handleExpansionModeChange"
				  class="rounded-md border border-base-border bg-base-foreground px-2 py-1 text-xs text-base-content"
			  >
				<option value="" aria-label="Manual expansion"></option>
				<option value="everything">Everything</option>
				<option value="family" :disabled="isExpansionRankUnavailable('family')">Families</option>
				<option value="genus" :disabled="isExpansionRankUnavailable('genus')">Genera</option>
				</select>
			  </label>
			  <button
				type="button"
				:disabled="isDefaultView || isResetting"
				class="text-xs font-semibold transition-colors enabled:text-secondary enabled:hover:underline disabled:cursor-not-allowed disabled:text-base-content/35"
				@click="resetView"
			  >
				Reset view
			  </button>
			</div>
			<p
			  v-if="outside"
			  class="mt-2 text-sm text-base-content/70"
			>
			  That taxon is outside both trees.
			  <RouterLink
				class="text-secondary underline"
				:to="{ name: 'otus-id', params: { id: outside } }"
			  >Open its page</RouterLink>
			</p>
		  </div>

		  <div
			class="inline-flex self-start box-border h-[3.25rem] rounded-xl bg-base-foreground ring-2 ring-secondary p-1 text-sm font-semibold"
			role="group"
			aria-label="Taxonomy view"
		  >
			<button
			  v-for="opt in VIEWS"
			  :key="opt.value"
			  type="button"
			  class="px-4 h-full rounded-lg transition-colors"
			  :class="view === opt.value ? 'bg-secondary text-secondary-content shadow' : 'text-base-content hover:bg-base-muted/50'"
			  :aria-pressed="view === opt.value"
			  @click="setView(opt.value)"
			>
			  {{ opt.label }}
			</button>
		  </div>
		</div>

		<RecentTaxaList v-if="view === 'recent'" />

		<div
		  v-if="view === 'browse' && focusedTaxon"
		  class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-base-foreground p-4 ring-1 ring-base-border/40"
		>
		  <nav
			aria-label="Taxon ancestors"
			class="flex flex-wrap items-center gap-2 text-sm"
		  >
			<template
			  v-for="ancestor in focusedTaxon.ancestors"
			  :key="ancestor.id"
			>
			  <RouterLink
				class="text-secondary hover:underline"
				:to="{ name: 'otus-id', params: { id: ancestor.id } }"
			  >{{ ancestor.name }}</RouterLink>
			  <span
				class="text-base-content/40"
				aria-hidden="true"
			  >/</span>
			</template>
			<strong class="font-semibold text-base-content">{{ focusedTaxon.label }}</strong>
		  </nav>
		  <button
			type="button"
			class="text-sm font-semibold text-secondary hover:underline"
			@click="clearFocusedTaxon"
		  >
			Show full taxonomy
		  </button>
		</div>

		<div
		  v-if="view === 'browse' && focusedTaxon"
		  class="max-w-4xl"
		>
		  <TaxonomyTree
			:otu-id="focusedTaxon.otuId"
			:show-invalid="showInvalid"
				:expand-through="focusedExpandThrough"
			  :reset-version="resetTreeVersion"
			:title="`Taxonomy around ${focusedTaxon.label}`"
		  />
		</div>

		<div
		  v-else-if="view === 'browse'"
		  class="flex flex-col md:flex-row gap-6"
		>
		  <div class="flex-1">
			<TaxonomyTree
			  :key="`${FLEA_ROOT}-${treeResetKey}`"
			  :otu-id="FLEA_ROOT"
			  :path="fullTreePath"
			  :show-invalid="showInvalid"
			  :expand-through="expandThrough"
			  :reset-version="resetTreeVersion"
			  @expansion-change="updateTreeExpansion"
			  title="Explore flea taxonomy" />
		  </div>

		  <div class="flex-1">
			<TaxonomyTree
			  :key="`${HOST_ROOT}-${treeResetKey}`"
			  :otu-id="HOST_ROOT"
			  :path="fullTreePath"
			  :show-invalid="showInvalid"
			  :expand-through="expandThrough"
			  :reset-version="resetTreeVersion"
			  @expansion-change="updateTreeExpansion"
			  title="Explore host taxonomy" />
		  </div>
		</div>
	</div>
    <SectionAnnouncements />
    <SectionTerms />
  </div>
</template>

<script setup>
import { computed, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { makeAPIRequest } from '@/utils/request'
import GlobalSearch from './components/Search/GlobalSearch.vue'
import RecentTaxaList from './components/Recent/RecentTaxaList.vue'
import TaxonomyTree from './components/Taxonomy/TaxonomyTree.vue'

const FLEA_ROOT = 1366469
const HOST_ROOT = 1373846
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

const route = useRoute()
const router = useRouter()
const outside = ref(null)
const focusedTaxon = ref(null)
const fullTreePath = ref([])
const manualTreeOverrides = ref(new Set())
const resetTreeVersion = ref(0)
const treeResetKey = ref(0)
const isResetting = ref(false)
const focusedExpandThrough = ref('everything')

const stripTags = (value) =>
	String(value || '')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.trim()

async function revealTaxon(otuId, syncUrl = true) {
  outside.value = null
	focusedTaxon.value = null
	focusedExpandThrough.value = 'everything'
	fullTreePath.value = []
  view.value = 'browse'
  try {
		const taxonId = Number(otuId)
		if (!Number.isSafeInteger(taxonId) || taxonId < 1) return
		const { data } = await makeAPIRequest.get(`/otus/${taxonId}`, {
			params: { extend: ['parents', 'taxon_name'] }
		})
		const parents = Object.entries(data.parents || {})
			.map(([name, list]) => ({ id: Number(list?.[0]?.id), name: stripTags(name) }))
			.filter((ancestor) => ancestor.id && ancestor.name && ancestor.name !== 'Root')
		const chain = new Set([...parents.map((ancestor) => ancestor.id), Number(data.id)])
		const treeRoot = chain.has(FLEA_ROOT) ? FLEA_ROOT : chain.has(HOST_ROOT) ? HOST_ROOT : null

		if (!treeRoot) {
			outside.value = data.id
			if (syncUrl) await setFocusedTaxonQuery(null)
			return
		}

		const rootIndex = parents.findIndex((ancestor) => ancestor.id === treeRoot)
		const ancestors = parents.slice(rootIndex < 0 ? 0 : rootIndex)
		focusedTaxon.value = {
			otuId: Number(data.id),
			label: stripTags(data.object_tag || data.name) || `Taxon ${data.id}`,
			rank: String(data.taxon_name?.rank || '').toLowerCase(),
			ancestors,
			path: [...ancestors.map((ancestor) => ancestor.id), Number(data.id)]
		}
		if (syncUrl) await setFocusedTaxonQuery(data.id)
  } catch {
		focusedTaxon.value = null
		if (syncUrl) await setFocusedTaxonQuery(null)
  }
}

async function setFocusedTaxonQuery(otuId) {
	const query = { ...route.query }
	if (otuId) query.otu = String(otuId)
	else delete query.otu
	if (String(route.query.otu || '') !== String(otuId || '')) {
		await router.replace({ query })
	}
}

function clearFocusedTaxon() {
	fullTreePath.value = focusedTaxon.value?.path || []
	focusedTaxon.value = null
	void setFocusedTaxonQuery(null)
}

function clearTaxonHighlight() {
	fullTreePath.value = []
}

provide('clearTaxonHighlight', clearTaxonHighlight)

const isDefaultView = computed(() =>
	view.value === 'browse' &&
	!focusedTaxon.value &&
	!fullTreePath.value.length &&
	!showInvalid.value &&
	!expandThrough.value &&
	manualTreeOverrides.value.size === 0
)

const activeExpandThrough = computed({
	get: () => focusedTaxon.value ? focusedExpandThrough.value : expandThrough.value,
	set: (value) => {
		if (focusedTaxon.value) focusedExpandThrough.value = value
		else expandThrough.value = value
	}
})

function isExpansionRankUnavailable(rank) {
	if (!focusedTaxon.value) return false
	const focusedRankLevel = RANK_LEVEL[focusedTaxon.value.rank]
	const selectedRankLevel = RANK_LEVEL[rank]
	return focusedRankLevel !== undefined && focusedRankLevel >= selectedRankLevel
}

function updateTreeExpansion(key, isOverride) {
	const next = new Set(manualTreeOverrides.value)
	if (isOverride) next.add(key)
	else next.delete(key)
	manualTreeOverrides.value = next
}

function setView(value) {
	view.value = value
	if (value === 'recent') manualTreeOverrides.value = new Set()
}

function handleExpansionModeChange() {
	clearTaxonHighlight()
	manualTreeOverrides.value = new Set()
}

async function resetView() {
	if (isDefaultView.value || isResetting.value) return
	isResetting.value = true
	if (view.value === 'recent') view.value = 'browse'
	resetTreeVersion.value += 1
	const prefersReducedMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
	if (!prefersReducedMotion) await new Promise((resolve) => setTimeout(resolve, 400))
	view.value = 'browse'
	focusedTaxon.value = null
	focusedExpandThrough.value = 'everything'
	void setFocusedTaxonQuery(null)
	fullTreePath.value = []
	showInvalid.value = false
	expandThrough.value = ''
	manualTreeOverrides.value = new Set()
	treeResetKey.value += 1
	isResetting.value = false
}

const VIEWS = [
  { label: 'Browse tree', value: 'browse' },
  { label: 'Recently added', value: 'recent' }
]
const view = ref('browse')
const showInvalid = ref(false)
const expandThrough = ref('')

watch(
	() => route.query.otu,
	(value) => {
		if (value == null) {
			if (focusedTaxon.value) {
				focusedTaxon.value = null
				fullTreePath.value = []
				outside.value = null
			}
			return
		}
		const otuId = Array.isArray(value) ? value[0] : value
		if (/^[1-9]\d*$/.test(String(otuId)) && Number(focusedTaxon.value?.otuId) !== Number(otuId)) {
			void revealTaxon(otuId, false)
		}
	},
	{ immediate: true }
)
</script>
