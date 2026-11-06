<template>
  <VCard>
    <div class="relative">
      <Teleport to="body">
        <VModal
          v-if="activeCitation"
          @close="activeCitation = null"
        >
          <template #header>
            <div class="text-sm font-medium">Reference</div>
          </template>
          <div
            class="px-4 pb-4 text-sm leading-relaxed"
            v-html="linkify(activeCitation.full)"
          />
        </VModal>
      </Teleport>
      <ClientOnly>
        <VSpinner v-if="isLoading" />
        <VMap
          ref="mapRef"
          class="h-96 max-h-96"
          dragging
          :cluster="cluster"
          :zoom="zoom"
          :zoom-bounds="8"
          :geojson="store.distribution.geojson"
          :cluster-icon-create-function="makeClusterIconFor"
          :geojson-options="geojsonOptions"
          @geojson:ready="onGeojsonReady"
        />
        <div class="absolute right-3 top-3 z-[400] flex gap-2">
          <VButton
            v-if="isFocused"
            class="h-6 text-sm"
            @click="showAll"
          >
            Show all
          </VButton>
          <VButton
            class="h-6 text-sm"
            primary
            @click="() => (isOtuSearchVisible = true)"
          >
            Search
          </VButton>
        </div>
        <div ref="popupElement">
          <MapPopup
            v-if="popupItem"
            :items="popupItem.base"
            :targets="popupItem.target"
            @selected="dwcTableRef.show"
            @citation-selected="activeCitation = $event"
          />
        </div>

        <OtuSearch
          v-if="isOtuSearchVisible"
          :otu="otu"
          :shapes="store.distribution.geojson"
          @close="() => (isOtuSearchVisible = false)"
        />

        <CachedMap
          v-if="store.distribution.cachedMap"
          :cached-map="store.distribution.cachedMap"
        />
      </ClientOnly>
    </div>
    <div
      v-if="store.distribution.errorMessage"
      class="flex flex-row p-2 text-xs italic"
    >
      * {{ store.distribution.errorMessage }}
    </div>
    <div
      class="flex flex-row flex-wrap p-2 gap-2 text-xs"
      v-if="store.distribution.currentShapeTypes.length || hasGbifRecords"
    >
      <div
        v-for="type in store.distribution.currentShapeTypes"
        :key="type"
        class="flex flex-row items-center"
      >
        <div
          :class="['w-3', 'h-3', 'm-1', 'rounded-sm', LEGEND[type].background, LEGEND[type].shape]"
        />
        <span>{{ LEGEND[type].label }}</span>
      </div>
      <label
        v-if="hasGbifRecords"
        class="flex flex-row items-center cursor-pointer"
      >
        <input
          v-model="showGbif"
          type="checkbox"
          class="mr-1"
        />
        <div
          class="w-3 h-3 m-1 [clip-path:polygon(25%_0,75%_0,100%_50%,75%_100%,25%_100%,0_50%)]"
          style="background: rgb(0, 103, 25)"
        />
        <span>GBIF preserved specimens</span>
      </label>
    </div>
    <DwcTable ref="dwcTableRef" />
  </VCard>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

function linkify(html) {
  if (!html) return ''
  return html.replace(
    /(?<!href=["'])(?<!">)(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-secondary hover:underline">$1</a>'
  )
}
import { useDistributionStore } from './store/useDistributionStore.js'
import { makeClusterIconFor } from './clusters'
import { useGeojsonOptions } from './composables/useGeojsonOptions.js'
import { LEGEND } from './constants'
import MapPopup from './components/MapPopup.vue'
import CachedMap from './components/CachedMap.vue'
import OtuSearch from './components/Search/OtuSearch.vue'
import DwcTable from './components/DwcTable.vue'
import { useGbifOverlay } from './composables/useGbifOverlay.js'
import { getSpecimenFocusBounds } from './utils/getSpecimenFocusBounds.js'

const props = defineProps({
  otuId: {
    type: [String, Number],
    required: true
  },

  otu: {
    type: Object,
    required: true
  },

  taxon: {
    type: Object,
    required: true
  },

  cluster: {
    type: Boolean,
    default: false
  }
})

const zoom = 2
const isLoading = ref(true)
const activeCitation = ref(null)
const isOtuSearchVisible = ref(false)
const dwcTableRef = ref(null)
const store = useDistributionStore()
const popupElement = ref(null)
const mapRef = ref(null)
const isFocused = ref(false)

function fitTo(bounds) {
  const map = mapRef.value?.getMapObject?.()
  if (!map) return
  map.fitBounds(bounds, {
    padding: [50, 50],
    maxZoom: zoom + 3,
    animate: false
  })
}

function onGeojsonReady() {
  isLoading.value = false
  isFocused.value = false

  const geojson = store.distribution.geojson
  const focus = getSpecimenFocusBounds(geojson)
  // Wrapped boundaries repeat across world copies, which would stretch VMap's own fit
  const full = getSpecimenFocusBounds(geojson, { trim: 0, minSamples: 1 })
  const bounds = focus || full
  if (!bounds) return

  // VMap refits to all shapes on resize; wait for that before focusing
  setTimeout(() => {
    fitTo(bounds)
    isFocused.value = !!focus
  }, 200)
}

function showAll() {
  const full = getSpecimenFocusBounds(store.distribution.geojson, {
    trim: 0,
    minSamples: 1
  })
  if (full) fitTo(full)
  else mapRef.value?.resizeMap?.()
  isFocused.value = false
}
const { enabled: showGbif, hasRecords: hasGbifRecords } = useGbifOverlay({
  mapRef,
  taxon: props.taxon,
  otu: props.otu
})
const { popupItem, geojsonOptions } = useGeojsonOptions({ popupElement })

onMounted(() => {
  isLoading.value = true

  store.loadDistribution({
    otuId: props.otuId,
    rankString: props.taxon.rank_string
  })
})

onBeforeUnmount(() => {
  store.resetRequest()
  store.$reset()
})
</script>
