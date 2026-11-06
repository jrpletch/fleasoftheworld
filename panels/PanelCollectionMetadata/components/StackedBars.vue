<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    class="w-full h-auto"
    role="img"
  >
    <g
      v-for="tick in ticks"
      :key="tick"
    >
      <line
        :x1="left"
        :x2="width"
        :y1="y(tick)"
        :y2="y(tick)"
        stroke="currentColor"
        stroke-opacity="0.12"
      />
      <text
        :x="left - 4"
        :y="y(tick) + 3"
        text-anchor="end"
        font-size="9"
        fill="currentColor"
        fill-opacity="0.7"
      >
        {{ tick }}
      </text>
    </g>

    <g
      v-for="(bar, i) in bars"
      :key="bar.label"
    >
      <title>
        {{ bar.label }}: {{ bar.tw + bar.gbif }} (TaxonWorks {{ bar.tw }}, GBIF
        {{ bar.gbif }})
      </title>
      <rect
        :x="x(i)"
        :y="y(bar.tw)"
        :width="barWidth"
        :height="Math.max(0, y(0) - y(bar.tw))"
        :fill="TW_COLOR"
      />
      <rect
        :x="x(i)"
        :y="y(bar.tw + bar.gbif)"
        :width="barWidth"
        :height="Math.max(0, y(bar.tw) - y(bar.tw + bar.gbif))"
        :fill="GBIF_COLOR"
      />
      <text
        v-if="showLabel(i)"
        :x="x(i) + barWidth / 2"
        :y="height - 4"
        text-anchor="middle"
        font-size="9"
        fill="currentColor"
        fill-opacity="0.8"
      >
        {{ bar.label }}
      </text>
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { TW_COLOR, GBIF_COLOR, niceTicks } from '../utils/chart.js'

const props = defineProps({
  // [{ label, tw, gbif }]
  bars: { type: Array, required: true },
  height: { type: Number, default: 140 },
  labelEvery: { type: Number, default: 1 }
})

const width = 360
const left = 30
const bottom = 16
const top = 6

const max = computed(() =>
  Math.max(1, ...props.bars.map((b) => b.tw + b.gbif))
)
const ticks = computed(() => niceTicks(max.value))
const scaleMax = computed(() => ticks.value[ticks.value.length - 1])
const slot = computed(() => (width - left) / Math.max(1, props.bars.length))
const barWidth = computed(() => Math.max(1, slot.value * 0.78))

const x = (i) => left + i * slot.value + (slot.value - barWidth.value) / 2
const y = (v) =>
  top + (1 - v / scaleMax.value) * (props.height - bottom - top)
const showLabel = (i) => i % props.labelEvery === 0
</script>
