<template>
  <div>
    <VCard v-if="isLoading || images.length">
      <VCardContent>
      <div
        class="flex flex-wrap gap-1 border-b border-base-border/50"
        role="tablist"
        aria-label="Image categories"
      >
        <button
          v-for="category in categories"
          :id="tabId(category)"
          :key="category"
          type="button"
          role="tab"
          class="border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :class="selectedCategory === category
            ? 'border-primary text-primary'
            : 'border-transparent text-base-content/60 hover:text-base-content'"
          :aria-selected="selectedCategory === category"
          :aria-controls="panelId(category)"
          @click="selectedCategory = category"
        >
          {{ category }}
        </button>
      </div>

      <section
        :id="panelId(selectedCategory)"
        class="pt-4"
        role="tabpanel"
        :aria-labelledby="tabId(selectedCategory)"
        tabindex="0"
      >
        <VSpinner
          v-if="isLoading"
          logo-class="w-8 h-8"
          legend=""
        />
        <p
          v-else-if="loadError"
          class="py-8 text-center text-sm text-base-content/60"
        >
          {{ loadError }}
        </p>
        <div
          v-else-if="filteredImages.length"
          class="flex flex-col gap-3"
        >
          <div class="flex justify-center border border-base-muted bg-base-background print:hidden">
            <GalleryMainImage
              :image="currentImage"
              @open:viewer="isImageViewerOpen = true"
            />
          </div>

          <figcaption
            v-if="currentImage.depictions?.length"
            class="space-y-1 text-sm leading-relaxed text-base-content/70"
          >
            <p
              v-for="depiction in currentImage.depictions"
              :key="depiction.id"
            >
              {{ depiction.label }}
            </p>
          </figcaption>

          <div
            v-if="currentImage.citations?.length"
            class="space-y-1 text-sm leading-relaxed text-base-content/70"
            aria-label="Image citations"
          >
            <p
              v-for="citation in currentImage.citations"
              :key="citation.id"
            >
              <span
                v-html="sanitizeAndLinkifyHtml(citation.source?.cached || citation.source?.label || citation.citation_source_body || '')"
              />
              <span v-if="citation.pages"> ({{ citation.pages }})</span>
            </p>
          </div>

          <div class="flex gap-1.5 overflow-x-auto pb-2">
            <button
              v-for="(image, index) in filteredImages"
              :key="image.id"
              type="button"
              class="h-20 w-24 flex-shrink-0 overflow-hidden rounded-md border bg-base-background"
              :class="galleryIndex === index ? 'border-secondary' : 'border-base-muted'"
              :aria-label="`Show image ${index + 1}: ${image.depictions?.map((depiction) => depiction.label).join('; ') || 'taxon image'}`"
              :aria-pressed="galleryIndex === index"
              @click="galleryIndex = index"
            >
              <img
                :src="image.thumb"
                :alt="image.depictions?.map((depiction) => depiction.label).join('; ') || ''"
                class="h-full w-full object-contain"
              />
            </button>
          </div>
        </div>
        <p
          v-else
          class="py-8 text-center text-sm text-base-content/60"
        >
          No images tagged “{{ selectedCategory }}” for this taxon yet.
        </p>
      </section>
      </VCardContent>
    </VCard>

    <ImageViewer
      v-if="isImageViewerOpen && filteredImages.length"
      class="flea-gallery-image-viewer"
      :index="galleryIndex"
      :images="viewerImages"
      :next="galleryIndex < viewerImages.length - 1"
      :previous="galleryIndex > 0"
      @select-index="galleryIndex = $event"
      @next="galleryIndex++"
      @previous="galleryIndex--"
      @close="isImageViewerOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { makeAPIRequest } from '@/utils/request'
import { sanitizeAndLinkifyHtml } from '@/utils'
import GalleryMainImage from '@/components/Gallery/GalleryMainImage.vue'
import ImageViewer from '@/components/ImageViewer/ImageViewer.global.vue'

const props = defineProps({
  otuId: {
    type: [String, Number],
    required: true
  }
})

const categories = ['Images', 'Figures', 'SEM', 'Larvae']
const selectedCategory = ref(categories[0])
const images = ref([])
const tagsByImage = ref(new Map())
const citationsByImage = ref(new Map())
const isLoading = ref(false)
const loadError = ref('')
const isImageViewerOpen = ref(false)
const galleryIndex = ref(0)
const { url: apiUrl, project_token: projectToken } = __APP_ENV__
let requestController
let loadSequence = 0

const filteredImages = computed(() =>
  images.value.filter((image) =>
    tagsByImage.value.get(String(image.id))?.has(selectedCategory.value.toLowerCase())
  )
)
const currentImage = computed(() => filteredImages.value[galleryIndex.value] || {})
const viewerImages = computed(() => filteredImages.value.map((image) => {
  const imageSource = image.source?.label
    ? sanitizeAndLinkifyHtml(image.source.label)
    : ''
  const citations = (image.citations || [])
    .map((citation) => {
      const source = sanitizeAndLinkifyHtml(
        citation.source?.cached || citation.source?.label || citation.citation_source_body || ''
      )
      if (!source) return ''
      const pages = citation.pages ? ` (${sanitizeAndLinkifyHtml(citation.pages)})` : ''
      return `<strong>Associated citation:</strong> ${source}${pages}`
    })
    .filter(Boolean)

  return {
    ...image,
    source: {
      ...(image.source || {}),
      label: [imageSource, ...citations].filter(Boolean).join('<br>')
    }
  }
}))

watch(selectedCategory, () => {
  galleryIndex.value = 0
  isImageViewerOpen.value = false
})

function tabId(category) {
  return `flea-gallery-tab-${category.toLowerCase()}`
}

function panelId(category) {
  return `flea-gallery-panel-${category.toLowerCase()}`
}

async function loadImages(otuId) {
  const sequence = ++loadSequence
  requestController?.abort()
  requestController = new AbortController()
  images.value = []
  tagsByImage.value = new Map()
  citationsByImage.value = new Map()
  galleryIndex.value = 0
  isImageViewerOpen.value = false
  loadError.value = ''

  if (!otuId) {
    isLoading.value = false
    return
  }

  isLoading.value = true

  try {
    const { data: response } = await makeAPIRequest.get(
      `/otus/${otuId}/inventory/images.json`,
      {
        params: {
          extend: ['depictions', 'attribution', 'source', 'citations'],
          otu_scope: ['all', 'coordinate_otus'],
          sort_order: []
        },
        signal: requestController.signal
      }
    )

    if (sequence !== loadSequence) return

    images.value = (response.image_order || [])
      .filter(Boolean)
      .map((id) => {
        const image = { ...response.images[id], id: String(id) }
        if (image.original_png) {
          image.original = `${apiUrl}/${image.original_png.substring(8)}?project_token=${projectToken}`
        }
        return image
      })

    const imageIds = images.value.map((image) => image.id)
    if (!imageIds.length) return

    let data
    let citationData = []
    try {
      const [tagsResponse, citationsResponse] = await Promise.all([
        makeAPIRequest.get('/tags', {
          params: {
            tag_object_type: 'Image',
            tag_object_id: imageIds,
            per: 1000
          },
          signal: requestController.signal
        }),
        makeAPIRequest.get('/citations', {
          params: {
            citation_object_type: 'Image',
            citation_object_id: imageIds,
            extend: ['source'],
            per: 1000
          },
          signal: requestController.signal
        })
      ])
      data = tagsResponse.data || []
      citationData = citationsResponse.data || []
    } catch (requestError) {
      if (sequence !== loadSequence) return
      if (requestError.name === 'CanceledError' || requestError.name === 'AbortError') return
      loadError.value = 'Image tags could not be loaded. Please try again later.'
      return
    }

    if (sequence !== loadSequence) return

    const groupedTags = new Map()
    const categoryNames = new Set(categories.map((category) => category.toLowerCase()))
    for (const tag of data) {
      const imageId = String(tag.tag_object_id)
      const label = tag.keyword?.name?.trim().toLowerCase()
      if (!label || !categoryNames.has(label)) continue

      if (!groupedTags.has(imageId)) groupedTags.set(imageId, new Set())
      groupedTags.get(imageId).add(label)
    }

    for (const imageId of imageIds) {
      const key = String(imageId)
      if (!groupedTags.get(key)?.size) groupedTags.set(key, new Set(['images']))
    }

    tagsByImage.value = groupedTags
    for (const citation of citationData) {
      const imageId = String(citation.citation_object_id)
      if (!citationsByImage.value.has(imageId)) citationsByImage.value.set(imageId, [])
      citationsByImage.value.get(imageId).push(citation)
    }
    images.value = images.value.map((image) => ({
      ...image,
      citations: citationsByImage.value.get(String(image.id)) || []
    }))
  } catch (requestError) {
    if (sequence !== loadSequence) return
    if (requestError.name === 'CanceledError' || requestError.name === 'AbortError') return
    loadError.value = 'Images could not be loaded. Please try again later.'
  } finally {
    if (sequence === loadSequence) isLoading.value = false
  }
}

watch(() => props.otuId, loadImages, { immediate: true })

onBeforeUnmount(() => {
  loadSequence++
  requestController?.abort()
})
</script>

<style>
.flea-gallery-image-viewer .attributions {
  box-sizing: border-box;
  width: calc(100% - 2rem);
  max-width: 72rem;
  max-height: 7rem;
  overflow-y: auto;
  margin: 0 auto 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--tp-base-border);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--tp-base-background) 90%, var(--tp-primary) 10%);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.08);
  text-align: left;
  overscroll-behavior: contain;
}

.flea-gallery-image-viewer .absolute.rounded-t-lg {
  bottom: 14rem;
  max-height: calc(100% - 14rem);
}
</style>