<template>
  <div ref="mapElement" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { makeTileFromConfiguration } from '@/components/Map/utils/makeTileFromConfiguration'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  points: { type: Array, default: () => [] },
  distributions: { type: Array, default: () => [] }
})

const mapElement = ref(null)
let L
let map
let activityLayer
let resizeObserver
let disposed = false

function isPrimaryType(point) {
  return /\b(holotype|lectotype|neotype|syntype|cotype|primary type)\b/i.test(point.typeStatus || '')
}

function specimenPopup(point) {
  const root = document.createElement('div')
  const title = document.createElement('div')
  title.style.fontStyle = 'italic'
  title.textContent = point.name
  root.append(title)

  ;[
    point.typeStatus,
    point.locality,
    point.date,
    [point.institutionCode, point.catalogNumber].filter(Boolean).join(' '),
    point.recordedBy ? `Collected by ${point.recordedBy}` : '',
    point.pages ? `Source page ${point.pages}` : ''
  ].filter(Boolean).forEach((line) => {
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

function distributionPopup(feature) {
  const properties = feature.properties || {}
  const popup = document.createElement('div')
  const heading = document.createElement('strong')
  heading.textContent = properties.areaLabel || 'Asserted distributions'
  popup.append(heading)

  const taxa = properties.taxa || []
  const summary = document.createElement('p')
  summary.textContent = `${taxa.length} taxa · ${taxa.reduce((count, taxon) => count + taxon.count, 0)} assertions`
  popup.append(summary)

  const list = document.createElement('ul')
  for (const taxon of taxa) {
    const item = document.createElement('li')
    if (taxon.otuId) {
      const link = document.createElement('a')
      link.href = `#/otus/${taxon.otuId}/overview`
      link.textContent = taxon.name
      item.append(link)
    } else item.textContent = taxon.name
    if (taxon.pages) item.append(document.createTextNode(` · p. ${taxon.pages}`))
    list.append(item)
  }
  popup.append(list)
  return popup
}

function specimenIcon(point) {
  const primary = isPrimaryType(point)
  const color = primary ? 'var(--tp-map-type-material)' : 'var(--tp-map-collection-object)'
  const shape = primary
    ? 'transform:rotate(45deg);border-radius:1px;'
    : 'border-radius:50%;'
  const size = primary ? 13 : 11
  return L.divIcon({
    className: 'map-point-marker',
    html: `<div style="width:${size}px;height:${size}px;background:${color};box-sizing:border-box;border:1px solid #fff;${shape}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  })
}

function render() {
  if (!map || disposed) return
  activityLayer?.remove()
  activityLayer = L.featureGroup().addTo(map)

  if (props.distributions.length) {
    L.geoJSON(
      { type: 'FeatureCollection', features: props.distributions },
      {
        style: {
          color: 'var(--tp-map-asserted)',
          fillColor: 'var(--tp-map-asserted)',
          fillOpacity: 0.22,
          opacity: 0.9,
          weight: 1.5
        },
        onEachFeature(feature, layer) {
          layer.bindPopup(distributionPopup(feature))
        }
      }
    ).addTo(activityLayer)
  }

  for (const point of props.points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue
    L.marker([point.lat, point.lng], {
      icon: specimenIcon(point),
      zIndexOffset: isPrimaryType(point) ? 1000 : 0
    })
      .bindPopup(specimenPopup(point))
      .addTo(activityLayer)
  }

  const bounds = activityLayer.getBounds()
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 7 })
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

watch(() => [props.points, props.distributions], render, { deep: true })

onBeforeUnmount(() => {
  disposed = true
  resizeObserver?.disconnect()
  map?.remove()
})
</script>
