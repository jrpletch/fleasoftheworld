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
			<label
			  v-show="view === 'browse'"
			  class="mt-2 inline-flex cursor-pointer select-none items-center gap-1.5 text-xs text-base-content/70"
			>
			  <input
				v-model="showInvalid"
				type="checkbox"
				class="h-3.5 w-3.5 accent-secondary"
			  />
			  Show invalid names
			</label>
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
			  @click="view = opt.value"
			>
			  {{ opt.label }}
			</button>
		  </div>
		</div>

		<RecentTaxaList v-if="view === 'recent'" />

		<div
		  v-show="view === 'browse'"
		  class="flex flex-col md:flex-row gap-6"
		>
		  <div class="flex-1">
			<TaxonomyTree
			  :otu-id="FLEA_ROOT"
			  :path="path"
			  :show-invalid="showInvalid"
			  title="Explore flea taxonomy" />
		  </div>

		  <div class="flex-1">
			<TaxonomyTree
			  :otu-id="HOST_ROOT"
			  :path="path"
			  :show-invalid="showInvalid"
			  title="Explore host taxonomy" />
		  </div>
		</div>
	</div>
    <SectionAnnouncements />
    <SectionTerms />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { makeAPIRequest } from '@/utils/request'
import GlobalSearch from './components/Search/GlobalSearch.vue'
import RecentTaxaList from './components/Recent/RecentTaxaList.vue'
import TaxonomyTree from './components/Taxonomy/TaxonomyTree.vue'

const FLEA_ROOT = 1366469
const HOST_ROOT = 1373846

const path = ref([])
const outside = ref(null)

// Expands both trees along the taxon's ancestor chain; the tree containing it scrolls to it.
async function revealTaxon(otuId) {
  outside.value = null
  view.value = 'browse'
  try {
    const { data } = await makeAPIRequest.get(`/otus/${otuId}`, { params: { extend: ['parents'] } })
    const ancestors = Object.values(data.parents || {}).map((list) => list[0]?.id)
    const chain = [...ancestors, data.id].filter(Boolean).map(Number)
    if (!chain.includes(FLEA_ROOT) && !chain.includes(HOST_ROOT)) outside.value = data.id
    path.value = chain
  } catch {
    path.value = []
  }
}

const VIEWS = [
  { label: 'Browse tree', value: 'browse' },
  { label: 'Recently added', value: 'recent' }
]
const view = ref('browse')
const showInvalid = ref(false)
</script>
