<template>
  <section class="rounded-2xl bg-base-foreground ring-1 ring-base-border/40 p-5 text-sm">
    <h2 class="mb-3 text-base font-semibold text-base-content">{{ title }}</h2>
    <p
      v-if="loading"
      class="text-base-content/50"
    >
      Loading…
    </p>
    <p
      v-else-if="!root"
      class="text-base-content/60"
    >
      No records found.
    </p>
    <ul v-else>
      <TaxonomyTreeNode
        :node="root"
        :path="relativePath"
        default-open
      />
    </ul>
  </section>
</template>

<script setup>
import { computed, onMounted, provide, ref, toRef } from 'vue'
import { makeAPIRequest } from '@/utils/request'
import TaxonomyTreeNode from './TaxonomyTreeNode.vue'

const props = defineProps({
  otuId: { type: [String, Number], required: true },
  title: { type: String, default: '' },
  // Full ancestor chain (root to taxon) of OTU ids to expand.
  path: { type: Array, default: () => [] },
  showInvalid: { type: Boolean, default: true }
})

provide('showInvalid', toRef(props, 'showInvalid'))

const root = ref(null)
const loading = ref(true)

const relativePath = computed(() => {
  const i = props.path.indexOf(Number(props.otuId))
  return i >= 0 ? props.path.slice(i) : []
})

onMounted(async () => {
  try {
    const { data } = await makeAPIRequest.get(`/otus/${props.otuId}/inventory/taxonomy.json`, {
      params: { max_descendants_depth: 1 }
    })
    root.value = data && Object.keys(data).length ? data : null
  } catch {
    root.value = null
  } finally {
    loading.value = false
  }
})
</script>
