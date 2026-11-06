import { ref, computed, watch, onBeforeUnmount } from 'vue'
import {
  useGbifMatch,
  deriveScientificName,
  CHECKLIST_KEY
} from '../../_gbifShared/useGbifMatch'

const TILE_URL =
  'https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@2x.png'
const BASIS_OF_RECORD = 'PRESERVED_SPECIMEN'
const GBIF_HUE = 163

export function useGbifOverlay({ mapRef, taxon, otu }) {
  const enabled = ref(true)
  const scientificName = computed(() => deriveScientificName(taxon, otu))
  const { gbifKey } = useGbifMatch(scientificName)
  // The capabilities endpoint ignores basisOfRecord, so a count can't confirm specimens exist
  const hasRecords = computed(() => !!gbifKey.value)

  let layer = null

  // Flat red tiles rotated to teal-green (Okabe-Ito bluish green), with a halo to separate from the basemap
  function applyFilter(map) {
    const pane = map?.getPane('gbifPane')
    if (pane) {
      pane.style.filter = `hue-rotate(${GBIF_HUE}deg) saturate(1.4) drop-shadow(0 0 1px white)`
    }
  }

  function removeLayer() {
    if (layer) {
      layer.remove()
      layer = null
    }
  }

  async function syncLayer() {
    removeLayer()

    const map = mapRef.value?.getMapObject?.()
    if (!map || !enabled.value || !hasRecords.value || !gbifKey.value) return

    const L = (await import('leaflet')).default
    // State may have changed while Leaflet was loading
    if (!enabled.value || !hasRecords.value || layer) return

    const params = new URLSearchParams({
      style: 'red.poly',
      bin: 'hex',
      hexPerTile: '70',
      taxonKey: gbifKey.value,
      checklistKey: CHECKLIST_KEY,
      basisOfRecord: BASIS_OF_RECORD,
      srs: 'EPSG:3857'
    })

    // Tile layers sit under vector shapes by default; use a pane above them
    if (!map.getPane('gbifPane')) {
      const pane = map.createPane('gbifPane')
      pane.style.zIndex = 450
      pane.style.pointerEvents = 'none'
    }
    applyFilter(map)

    layer = L.tileLayer(`${TILE_URL}?${params}`, {
      pane: 'gbifPane',
      attribution:
        'Preserved specimens &copy; <a href="https://www.gbif.org">GBIF</a>',
      maxZoom: 18,
      opacity: 0.8
    }).addTo(map)
  }

  watch([enabled, hasRecords, gbifKey, () => mapRef.value], syncLayer, {
    immediate: true
  })

  onBeforeUnmount(removeLayer)

  return { enabled, hasRecords }
}
