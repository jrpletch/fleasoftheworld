<template>
  <div>
    <div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
      <label
        for="mountain-month"
        class="font-medium"
      >
        Month
      </label>
      <input
        id="mountain-month"
        v-model.number="slider"
        type="range"
        min="0"
        max="12"
        step="1"
        class="min-w-[10rem] flex-1 accent-[rgb(213,94,0)]"
        :aria-valuetext="monthLabel"
      />
      <span class="w-24 text-right font-semibold">{{ monthLabel }}</span>
    </div>

    <label
      v-if="hasEstimates || estimating"
      class="mb-3 flex items-center gap-2 text-xs"
    >
      <input
        v-model="includeEstimates"
        type="checkbox"
      />
      Include rough estimates from coordinates (DEM lookup for records without a
      recorded elevation)
      <span v-if="estimating">– loading…</span>
    </label>

    <svg
      :viewBox="`0 0 ${width} ${height}`"
      class="h-auto w-full"
      role="img"
      :aria-label="`Elevation range of records, ${monthLabel}`"
    >
      <defs>
        <clipPath id="mountain-clip">
          <path :d="mountainPath" />
        </clipPath>
      </defs>

      <g
        v-for="tick in ticks"
        :key="tick"
      >
        <line
          :x1="left"
          :x2="left + plotWidth"
          :y1="y(tick)"
          :y2="y(tick)"
          stroke="currentColor"
          stroke-opacity="0.15"
          stroke-dasharray="2 3"
        />
        <text
          :x="left - 4"
          :y="y(tick) + 3"
          text-anchor="end"
          font-size="9"
          fill="currentColor"
          fill-opacity="0.75"
        >
          {{ tick }} m
        </text>
      </g>

      <path
        :d="mountainPath"
        fill="currentColor"
        fill-opacity="0.1"
      />

      <g clip-path="url(#mountain-clip)">
        <rect
          v-for="band in bands"
          :key="band.index"
          :x="left"
          :y="y(band.top)"
          :width="plotWidth"
          :height="y(band.bottom) - y(band.top)"
          :fill="`rgb(${HEAT_COLOR})`"
          :fill-opacity="band.count ? 0.2 + 0.8 * (band.count / max) : 0"
        >
          <title>
            {{ band.bottom }}–{{ band.top }} m: {{ band.measured }} records{{
              band.estimated ? `, ~${band.estimated} estimated` : ''
            }}
          </title>
        </rect>
      </g>

      <path
        :d="mountainPath"
        fill="none"
        stroke="currentColor"
        stroke-opacity="0.55"
        stroke-width="1.5"
        stroke-linejoin="round"
      />

      <g
        v-for="band in bands"
        :key="`n${band.index}`"
      >
        <text
          v-if="band.count"
          :x="left + plotWidth + 6"
          :y="y((band.top + band.bottom) / 2) + 3"
          font-size="9"
          font-weight="600"
          fill="currentColor"
        >
          {{ band.measured || '' }}{{ band.estimated ? ` (+~${band.estimated})` : '' }}
        </text>
      </g>
    </svg>

    <p class="mt-1 text-xs">
      Shading shows how many records fall in each 500 m band
      {{ slider === 0 ? 'across all months' : `in ${monthName}` }}; the darkest
      band is relative to the busiest month and band.
    </p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { HEAT_COLOR, MONTH_NAMES } from '../utils/chart.js'

const props = defineProps({
  // [{ index, months, total, estimated, estimatedTotal }] one row per 500 m band, from 0 m
  rows: { type: Array, required: true },
  estimating: { type: Boolean, default: false }
})

const includeEstimates = ref(true)
const hasEstimates = computed(() => props.rows.some((r) => r.estimatedTotal))

const BAND = 500
const width = 360
const left = 46
const plotWidth = 240
const top = 8
const bottom = 6
const height = 260

// 0 = all months, 1-12 = January to December
const slider = ref(0)

const monthName = computed(() => MONTH_NAMES[slider.value - 1])
const monthLabel = computed(() =>
  slider.value === 0 ? 'All months' : monthName.value
)

// Fixed scale so a given elevation sits at the same height for every taxon
const scaleMax = computed(() => props.rows.length * BAND)

const y = (elevation) =>
  top + (1 - elevation / scaleMax.value) * (height - top - bottom)

const ticks = computed(() => {
  const list = []
  for (let v = 0; v <= scaleMax.value; v += 1000) list.push(v)
  return list
})

const bands = computed(() =>
  props.rows.map((r) => {
    const m = slider.value - 1
    const measured = slider.value === 0 ? r.total : r.months[m]
    const estimated = !includeEstimates.value
      ? 0
      : slider.value === 0
        ? r.estimatedTotal
        : r.estimated[m]

    return {
      index: r.index,
      bottom: r.index * BAND,
      top: (r.index + 1) * BAND,
      measured,
      estimated: Math.round(estimated),
      count: measured + estimated
    }
  })
)

// Scale shading to the busiest month so the slider shows real change
const max = computed(() =>
  Math.max(
    1,
    ...props.rows.flatMap((r) =>
      r.months.map((c, m) => c + (includeEstimates.value ? r.estimated[m] : 0))
    ),
    ...props.rows.map(
      (r) =>
        slider.value === 0
          ? r.total + (includeEstimates.value ? r.estimatedTotal : 0)
          : 0
    )
  )
)

// Ridge profile as [x fraction, height fraction]
const PROFILE = [
  [0, 0],
  [0.08, 0.14],
  [0.2, 0.42],
  [0.27, 0.58],
  [0.34, 0.5],
  [0.42, 0.78],
  [0.5, 1],
  [0.58, 0.8],
  [0.66, 0.66],
  [0.74, 0.72],
  [0.84, 0.4],
  [0.93, 0.15],
  [1, 0]
]

const mountainPath = computed(() => {
  const points = PROFILE.map(
    ([fx, fh]) => `${left + fx * plotWidth},${y(fh * scaleMax.value)}`
  )
  return `M${points.join(' L')} Z`
})
</script>
