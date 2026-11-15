<template>
  <VCard>
    <VCardHeader class="flex justify-between">
      <h2 class="text-md">Descendants and synonyms</h2>
      <PanelDropdown panel-key="panel:descendants-with-images" />
    </VCardHeader>
    <VCardContent class="text-sm">
      <ClientOnly>
        <VSpinner v-if="isLoading" logo-class="w-8 h-8" legend="" />
      </ClientOnly>
      <ul v-if="hasRecords" class="tree ml-2">
        <DescendantsTree :taxonomy="taxonomy" />
      </ul>
      <span v-else-if="!isLoading">No records found.</span>
    </VCardContent>
  </VCard>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useOtuPageRequest } from '@/modules/otus/helpers/useOtuPageRequest'
import TaxonWorks from '@/modules/otus/services/TaxonWorks'
import PanelDropdown from '@/modules/otus/components/Panel/PanelDropdown.vue'
import DescendantsTree from './DescendantsTree.vue'

const props = defineProps({ otuId: { type: [String, Number], required: true } })
const taxonomy = ref(null)
const isLoading = ref(false)
const hasRecords = computed(() => taxonomy.value && (
  taxonomy.value.nomenclatural_synonyms.length || taxonomy.value.descendants.length
))

watch(() => props.otuId, async () => {
  if (!props.otuId) return
  isLoading.value = true
  useOtuPageRequest('panel:descendants-with-images', () =>
    TaxonWorks.getTaxonomy(props.otuId, { params: { max_descendants_depth: 1 } })
  )
    .then(({ data }) => { taxonomy.value = data })
    .catch(() => {})
    .finally(() => { isLoading.value = false })
}, { immediate: true })
</script>

<style scoped>
.tree { list-style: none; margin: 0; padding: 0; }
.tree ul { margin-left: 14px; }
.tree li { position: relative; margin: 0; padding: 0 6px; border-left: 1px solid var(--tp-tree-line); }
.tree li:last-child { border-left: none; }
.tree li::before { position: relative; top: -0.3em; display: inline-block; left: -6px; width: 12px; height: 1em; border-bottom: 1px solid var(--tp-tree-line); content: ''; }
.tree li:last-child::before { border-left: 1px solid var(--tp-tree-line); }
</style>
