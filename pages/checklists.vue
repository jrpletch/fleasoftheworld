<template>
  <div class="grid grid-cols-2 gap-4 p-4">
    <!-- LEFT PANEL: Map -->
    <div class="h-[500px] border rounded overflow-hidden">
      <l-map v-model:zoom="zoom" :center="center" class="w-full h-full">
        <l-tile-layer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <l-geo-json
          v-if="geojson"
          :geojson="geojson"
          :options="{ onEachFeature }"
          :options-style="styleFeature"
        />
      </l-map>
    </div>

    <!-- RIGHT PANEL: Selected Country -->
    <div class="border rounded p-4">
      <h2 class="text-lg font-semibold mb-2">Selected Country</h2>
      <div v-if="selectedCountry">{{ selectedCountry }}</div>
      <div v-else class="text-gray-500">Click a country on the map</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { LMap, LTileLayer, LGeoJson } from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'

const zoom = ref(2)
const center = ref([20, 0])
const geojson = ref(null)
const selectedCountry = ref(null)
const highlightedLayer = ref(null)

// Load GeoJSON from public folder
onMounted(async () => {
  try {
    const res = await fetch('/fleasoftheworld/data/countries.geojson')
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = await res.json()
    console.log('GeoJSON loaded:', data)
    geojson.value = data
  } catch (err) {
    console.error('Error loading GeoJSON:', err)
  }
})

// Style for polygons
const styleFeature = (feature) => ({
  color: '#3388ff',
  weight: 1,
  fillOpacity: feature === highlightedLayer.value ? 0.5 : 0.2,
  interactive: true
})

// Click handler
const onEachFeature = (feature, layer) => {
  layer.on({
    click: () => {
      const props = feature.properties || {}
      const name = props.name || props.ADMIN || props.NAME || 'Unknown'
      console.log('Clicked:', name)
      selectedCountry.value = name

      // Clear previous highlight
      if (highlightedLayer.value) {
        highlightedLayer.value.setStyle({ fillOpacity: 0.2 })
      }
      highlightedLayer.value = layer
      layer.setStyle({ fillOpacity: 0.5 })
    },
    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.5 }),
    mouseout: (e) => {
      if (layer !== highlightedLayer.value) {
        e.target.setStyle({ fillOpacity: 0.2 })
      }
    }
  })
}
</script>

<style>
.leaflet-container {
  width: 100%;
  height: 100%;
}
</style>