import { DISABLE_LAYER_OPTIONS } from '@/components/Map/constants'
import * as Icons from '@/components/Map/icons'
import {
  TYPE_MATERIAL,
  COLLECTION_OBJECT,
  ASSERTED_ABSENT,
  ASSERTED_DISTRIBUTION,
  GEOREFERENCE,
  AGGREGATE
} from '@/constants/objectTypes.js'
import { computed, ref } from 'vue'

const TYPES = [
  TYPE_MATERIAL,
  COLLECTION_OBJECT,
  ASSERTED_ABSENT,
  ASSERTED_DISTRIBUTION,
  GEOREFERENCE,
  AGGREGATE
]

// Distinct shapes so point types are not distinguished by color alone
const MARKERS = {
  [TYPE_MATERIAL]: {
    size: 12,
    color: 'var(--tp-map-type-material)',
    css: 'transform:rotate(45deg);border:1px solid #fff;'
  },
  [COLLECTION_OBJECT]: {
    size: 10,
    color: 'var(--tp-map-collection-object)',
    css: 'border:1px solid #fff;'
  },
  [GEOREFERENCE]: {
    size: 12,
    color: 'var(--tp-map-georeference)',
    css: 'clip-path:polygon(50% 0,100% 100%,0 100%);'
  }
}

function getRelevantType(base) {
  return base
    .map((b) => b.type)
    .sort((a, b) => TYPES.indexOf(a) - TYPES.indexOf(b))[0]
}

function makePointToLayer(L) {
  return (feature, latLng) => {
    const type = getRelevantType(feature.properties.base)
    const spec = MARKERS[type]
    if (!spec) {
      return L.marker(latLng, {
        icon: L.divIcon(Icons[type] || Icons.Georeference)
      })
    }

    const priority = TYPES.indexOf(type)
    const marker = L.marker(latLng, {
      icon: L.divIcon({
        className: 'map-point-marker',
        html: `<div style="width:${spec.size}px;height:${spec.size}px;background:${spec.color};box-sizing:border-box;${spec.css}"></div>`,
        iconSize: [spec.size, spec.size],
        iconAnchor: [spec.size / 2, spec.size / 2]
      }),
      zIndexOffset: (TYPES.length - priority) * 1000
    })

    marker.on('add', () => marker.getElement()?.setAttribute('aria-label', type))
    marker.pm.setOptions(DISABLE_LAYER_OPTIONS)

    return marker
  }
}

export function makeGeojsonOptions({ popupElement, popupItem }) {
  return function ({ L } = {}) {
    return {
      ...(L && { pointToLayer: makePointToLayer(L) }),
      onEachFeature: (feature, layer) => {
        layer.pm.setOptions(DISABLE_LAYER_OPTIONS)
        layer.pm.disable()

        if (feature.properties.base.some(({ label }) => Boolean(label))) {
          layer.on('popupopen', () => (popupItem.value = feature.properties))
          layer.on('popupclose', () => (popupItem.value = null))

          layer.bindPopup(popupElement.value, {
            minWidth: 400,
            maxWidth: 400
          })
        }
      }
    }
  }
}

export function useGeojsonOptions({ popupElement }) {
  const popupItem = ref(null)

  const geojsonOptions = computed(() =>
    makeGeojsonOptions({ popupElement, popupItem })
  )

  return {
    geojsonOptions,
    popupItem
  }
}
