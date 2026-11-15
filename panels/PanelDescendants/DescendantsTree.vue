<template>
  <li v-if="Object.keys(taxonomy).length" :key="taxonomy.otu_id">
    <button-expand
      v-if="!taxonomy.leaf_node"
      v-model="isTreeVisible"
      class="tree-toggle absolute -left-2.5 z-10"
    />
    <router-link
      class="text-secondary"
      :to="{ name: 'otus-id', params: { id: taxonomy.otu_id } }"
      v-html="taxonomy.name"
    />
    <svg
      v-if="hasImages"
      class="ml-1 inline h-3.5 w-3.5 text-base-content/60"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      role="img"
      aria-label="Images available"
      title="Images available"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 7h3l1.5-2h5L16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
    <span
      v-if="photoSummary?.photographed"
      class="ml-0.5 text-xs tabular-nums text-base-content/55"
      :aria-label="`${photoSummary.photographed} of ${photoSummary.total} species have images`"
    >
      ({{ photoSummary.photographed }}/{{ photoSummary.total }})
    </span>
    <ul v-if="taxonomy.nomenclatural_synonyms?.length" class="pb-2">
      <li v-for="synonym in taxonomy.nomenclatural_synonyms" :key="synonym">
        <span class="mr-1 text-orange-500">=</span><span v-html="synonym" />
      </li>
    </ul>
    <AnimationOpacity>
      <ul v-if="isTreeVisible && descendants.length" class="tree">
        <DescendantsTree v-for="item in descendants" :key="item.otu_id" :taxonomy="item" />
      </ul>
    </AnimationOpacity>
  </li>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import TaxonWorks from '@/modules/otus/services/TaxonWorks'
import { getTaxonPhotoSummary, getTaxonRank, hasSpeciesImages } from '../../pages/data/taxonImageAvailability'

defineOptions({ name: 'DescendantsTree' })
const props = defineProps({ taxonomy: { type: Object, required: true } })
const isTreeVisible = ref(Boolean(props.taxonomy.descendants?.length))
const descendants = ref([...(props.taxonomy.descendants || [])])
const hasImages = ref(false)
const photoSummary = ref(null)

async function loadImageAvailability(otuId) {
  const rank = await getTaxonRank(otuId)
  if (rank === 'species') {
    hasImages.value = await hasSpeciesImages(otuId, rank)
  } else {
    photoSummary.value = await getTaxonPhotoSummary(otuId)
    hasImages.value = Boolean(photoSummary.value?.photographed)
  }
}

onMounted(() => loadImageAvailability(props.taxonomy.otu_id))
watch(() => props.taxonomy.otu_id, (otuId) => loadImageAvailability(otuId))

watch(isTreeVisible, async (open) => {
  if (!open || descendants.value.length) return
  try {
    const { data } = await TaxonWorks.getTaxonomy(props.taxonomy.otu_id, {
      params: { max_descendants_depth: 1 }
    })
    descendants.value = data.descendants || []
  } catch {
    descendants.value = []
  }
})
</script>

<style scoped>
.tree {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tree ul {
  margin-left: 14px;
}

.tree li {
  position: relative;
  margin: 0;
  padding: 0 6px;
  border-left: 1px solid var(--tp-tree-line);
}

.tree li:last-child {
  border-left: none;
}

.tree li::before {
  position: relative;
  top: -0.3em;
  display: inline-block;
  left: -6px;
  width: 12px;
  height: 1em;
  border-bottom: 1px solid var(--tp-tree-line);
  content: '';
}

.tree li:last-child::before {
  border-left: 1px solid var(--tp-tree-line);
}

:deep(.tree-toggle) {
  z-index: 2;
  border-radius: 9999px;
  background-color: var(--tp-base-foreground);
  box-shadow: 0 0 0 2px var(--tp-base-foreground);
}
</style>
