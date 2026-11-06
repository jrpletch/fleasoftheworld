<template>
  <HorizontalBars
    :rows="rows"
    label-class="w-40 sm:w-56"
    wrap
  />
</template>

<script setup>
import { computed } from 'vue'
import HorizontalBars from './HorizontalBars.vue'

const props = defineProps({
  // [{ biome, weight, source: 'tw' | 'gbif' }]
  records: { type: Array, required: true }
})

const rows = computed(() => {
  const byBiome = new Map()
  props.records.forEach((r) => {
    const row = byBiome.get(r.biome) || { label: r.biome, tw: 0, gbif: 0 }
    row[r.source] += r.weight
    byBiome.set(r.biome, row)
  })

  return [...byBiome.values()]
    .map((row) => ({ ...row, gbif: Math.round(row.gbif) }))
    .filter((row) => row.tw + row.gbif > 0)
    .sort((a, b) => b.tw + b.gbif - (a.tw + a.gbif))
})
</script>
