<template>
  <div class="flex flex-col gap-1 text-sm">
    <div
      v-for="row in rows"
      :key="row.label"
      class="flex items-center gap-2"
      :title="`${row.label}: ${row.tw + row.gbif} (TaxonWorks ${row.tw}, GBIF ${row.gbif})`"
    >
      <a
        v-if="row.href"
        :href="row.href"
        :title="row.title"
        target="_blank"
        rel="noopener noreferrer"
        :class="[
          'shrink-0 text-right',
          wrap ? 'break-words' : 'truncate',
          labelClass,
          'text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary'
        ]"
        >{{ row.label }}</a
      >
      <span
        v-else
        :class="[
          'shrink-0 text-right',
          wrap ? 'break-words' : 'truncate',
          labelClass
        ]"
        >{{ row.label }}</span
      >
      <div class="flex h-3 flex-1 items-center">
        <div
          class="h-full"
          :style="{ width: pct(row.tw), background: TW_COLOR }"
        />
        <div
          class="h-full"
          :style="{ width: pct(row.gbif), background: GBIF_COLOR }"
        />
      </div>
      <span class="w-10 shrink-0 tabular-nums text-xs">
        {{ row.tw + row.gbif }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { TW_COLOR, GBIF_COLOR } from '../utils/chart.js'

const props = defineProps({
  // [{ label, tw, gbif }]
  rows: { type: Array, required: true },
  labelClass: { type: String, default: 'w-40' },
  wrap: { type: Boolean, default: false }
})

const max = computed(() =>
  Math.max(1, ...props.rows.map((r) => r.tw + r.gbif))
)
const pct = (v) => `${(v / max.value) * 100}%`
</script>
