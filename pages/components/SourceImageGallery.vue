<template>
  <VCard>
    <VCardHeader>Images cited in this publication ({{ images.length }})</VCardHeader>
    <VCardContent>
      <div v-if="images.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <figure v-for="(image, index) in images" :key="image.id" class="min-w-0 overflow-hidden rounded-md border border-base-border bg-base-background">
          <button
            type="button"
            class="block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :aria-label="`Open image ${index + 1}: ${captionFor(image)}`"
            @click="openImage(index)"
          >
            <img
              :src="image.thumb || image.medium || image.original"
              :alt="captionFor(image)"
              class="h-36 w-full bg-base-muted/30 object-contain sm:h-44"
              loading="lazy"
            />
          </button>
          <figcaption class="space-y-1 p-2 text-xs leading-relaxed text-base-content/70">
            <p class="line-clamp-3">{{ captionFor(image) }}</p>
            <p v-if="image.pages" class="text-base-content/50">Publication page {{ image.pages }}</p>
          </figcaption>
        </figure>
      </div>
      <p v-else class="text-sm text-base-content/60">
        No images are cited to this publication in TaxonWorks.
      </p>
    </VCardContent>
  </VCard>

  <ImageViewer
    v-if="isViewerOpen"
    :index="selectedIndex"
    :images="images"
    :next="selectedIndex < images.length - 1"
    :previous="selectedIndex > 0"
    @select-index="selectedIndex = $event"
    @next="selectedIndex++"
    @previous="selectedIndex--"
    @close="isViewerOpen = false"
  />
</template>

<script setup>
import { ref } from 'vue'
import ImageViewer from '@/components/ImageViewer/ImageViewer.global.vue'

defineProps({
  images: { type: Array, default: () => [] }
})

const isViewerOpen = ref(false)
const selectedIndex = ref(0)

function captionFor(image) {
  const captions = (image.depictions || [])
    .map((depiction) => depiction.caption || depiction.label)
    .filter(Boolean)
  return captions.join('; ') || `Publication image ${image.id}`
}

function openImage(index) {
  selectedIndex.value = index
  isViewerOpen.value = true
}
</script>
