<template>
  <section class="wid-hero relative z-20 isolate text-white">
    <figure class="wid-hero-figure relative m-0 flex w-full items-center justify-center">
      <div class="wid-hero-background absolute inset-0 overflow-hidden" aria-hidden="true">
        <img
          :src="specimenImageUrl"
          alt="Barreropsylla excelsa specimen, collection number BYUC306976"
          class="wid-hero-image absolute inset-0 h-full w-full object-cover object-center"
          width="3500"
          height="2539"
        />
        <div
          class="absolute inset-0 bg-black/35"
        />
      </div>

        <div class="wid-hero-content relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-16 text-center">
          <h1 class="text-4xl font-bold leading-tight drop-shadow-lg sm:text-5xl lg:text-6xl">
            Fleas of the World
          </h1>

          <p class="mt-4 max-w-2xl text-base leading-relaxed text-white/90 drop-shadow sm:text-lg">
            A comprehensive database of global flea diversity.
          </p>

          <div class="wid-search-frame mt-7 w-full max-w-2xl rounded-2xl bg-white/35 p-2 shadow-lg ring-1 ring-white/35 backdrop-blur-sm">
            <div class="wid-search w-full">
              <GlobalSearch
                autofocus
                placeholder="Search a taxon, reference or author"
              />
            </div>
          </div>

          <ul class="mt-5 flex max-w-3xl flex-wrap justify-center gap-2 text-sm">
            <li
              v-for="link in quickLinks"
              :key="link.to"
            >
              <RouterLink
                :to="link.to"
                class="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-white ring-1 ring-white/35 transition-colors hover:bg-black/50"
              >
                <HomeIcon
                  :name="link.icon"
                  class="h-4 w-4 text-white"
                />
                {{ link.label }}
              </RouterLink>
            </li>
          </ul>
        </div>

        <figcaption class="wid-hero-caption absolute bottom-4 right-4 z-0 text-right text-sm text-white drop-shadow sm:bottom-6 sm:right-8">
          <RouterLink
            to="/otus/1367806/overview"
            class="rounded-sm bg-black/40 px-2 py-1 text-white hover:bg-black/60 hover:underline"
          >
            BYUC306976 <i>Barreropsylla excelsa</i>
          </RouterLink>
        </figcaption>
    </figure>
  </section>
  <section class="wid-hero-notice bg-base-background">
    <div class="container mx-auto px-4 pt-6 pb-20 lg:pt-8 lg:pb-24">
      <div class="rounded-xl bg-amber-50 p-3 sm:p-4 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:ring-amber-400/20">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <HomeIcon
            name="warning"
            class="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400"
          />
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold text-amber-900 dark:text-amber-200">
              A work in progress
            </h2>
            <p class="text-sm leading-snug text-amber-900/80 dark:text-amber-100/80">
              This project is under development. The core taxonomy of Siphonaptera is 
              in place, but the database is still being populated with type data, 
              literature, images, host associations, and distribution data.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import HomeIcon from './HomeIcon.vue'
import GlobalSearch from '../Search/GlobalSearch.vue'

const { base_url = '/' } = __APP_ENV__
const specimenImageUrl = `${base_url}images/Barreropsylla_excelsa_RDS-16914_10X.webp`

const quickLinks = [
  { label: 'Techniques', to: '/techniques', icon: 'document' },
  { label: 'Keys', to: '/keys', icon: 'key' },
  { label: 'Bibliography', to: '/resources/tw/filter/bibliography', icon: 'book' },
  { label: 'Specimen data', to: '/resources/tw/filter/dwc_otus', icon: 'database' }
]
</script>

<style scoped>
.wid-hero {
  width: 100%;
}

.wid-hero-image {
  object-position: center top;
}

.wid-hero-figure {
  height: min(78vh, 820px);
  min-height: 620px;
}

@media (max-width: 639px) {
  .wid-hero-figure {
    height: clamp(500px, calc(100vw + 200px), 560px);
    min-height: 0;
  }

  .wid-hero-image {
    object-fit: cover;
    object-position: 12% center;
  }

  .wid-hero-content {
    transform: translateY(-3rem);
  }

  .wid-hero-caption {
    top: auto;
    bottom: 1rem;
  }
}

</style>
