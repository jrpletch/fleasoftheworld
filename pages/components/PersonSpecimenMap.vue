<template>
  <div ref="mapElement" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { makeTileFromConfiguration } from '@/components/Map/utils/makeTileFromConfiguration'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  // [{ lat, lng, name, locality, date, otuId }]
  points: { type: Array, required: true }
})

const mapElement = ref(null)
let L
let map
let layer
let resizeObserver
let disposed = false

function popupFor(point) {
  const root = document.createElement('div')
  const title = document.createElement('div')
  title.style.fontStyle = 'italic'
  title.textContent = point.name
  root.append(title)
  ;[point.locality, point.date].filter(Boolean).forEach((line) => {
    const row = document.createElement('div')
    row.textContent = line
    root.append(row)
  })
  if (point.otuId) {
    const link = document.createElement('a')
    link.href = `#/otus/${point.otuId}/overview`
    link.textContent = 'View taxon'
    root.append(link)
  }
  return root
}

function render() {
  if (!map || disposed) return
  layer?.remove()
  layer = L.layerGroup()

  const bounds = []
  props.points.forEach((point) => {
    L.circleMarker([point.lat, point.lng], {
      radius: 6,
      color: '#ffffff',
      weight: 1.5,
      fillColor: '#d55e00',
      fillOpacity: 0.9
    })
      .bindPopup(() => popupFor(point))
      .addTo(layer)
    bounds.push([point.lat, point.lng])
  })
  layer.addTo(map)

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 7 })
  }
}

onMounted(async () => {
  const leaflet = await import('leaflet')
  if (disposed) return
  L = leaflet.default
  map = L.map(mapElement.value, { center: [15, 0], zoom: 2, worldCopyJump: true })
  map.attributionControl.setPrefix(false)

  const [tile] = Object.values(
    makeTileFromConfiguration(L, { maxZoom: 18, minZoom: 0, className: 'map-tiles' })
  )
  tile?.addTo(map)

  resizeObserver = new ResizeObserver(() => map?.invalidateSize({ animate: false }))
  resizeObserver.observe(mapElement.value)
  render()
})

watch(() => props.points, render)

onBeforeUnmount(() => {
  disposed = true
  resizeObserver?.disconnect()
  map?.remove()
})
</script>
