<template>
  <section class="container mx-auto px-4 py-16 sm:py-20">
    <div class="max-w-2xl">
      <h2 class="text-sm font-semibold uppercase tracking-wider text-primary-color dark:text-secondary-color">
        Explore the database
      </h2>
      <p class="mt-4 text-lg text-base-content/70">
        Browse the classification, identify specimens with keys, dig into
        the literature or query occurrence data.
      </p>
    </div>

    <div class="mt-10 grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="card in cards"
        :key="card.to"
        :to="card.to"
        class="group relative flex flex-col rounded-2xl bg-base-foreground p-5 sm:p-6 ring-1 ring-base-border/40 hover:ring-primary-color/50 dark:hover:ring-secondary-color/50 hover:shadow-lg hover:-translate-y-0.5 transition-all"
      >
        <h3 class="text-lg font-semibold text-base-content">
          {{ card.title }}
        </h3>
        <p class="mt-1.5 text-sm leading-relaxed text-base-content/65 flex-grow">
          {{ card.text }}
        </p>
        <span
          class="mt-3 sm:mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary-color dark:text-secondary-color"
        >
          {{ card.cta }}
          <HomeIcon
            name="arrow"
            class="h-4 w-4 transition-transform group-hover:translate-x-1"
          />
        </span>
      </RouterLink>
    </div>
  </section>
</template>

<script setup>
import HomeIcon from './HomeIcon.vue'

const cards = [
  {
    to: '/techniques',
    title: 'Flea techniques',
    text: 'Practical guidance on collecting fleas, mounting specimens, and extracting DNA.',
    cta: 'Browse techniques'
  },
  {
    to: '/morphology',
    title: 'Morphology',
    text: 'Explore flea morphology.',
    cta: 'Explore morphology'
  },
  {
    to: '/keys',
    title: 'Identification keys',
    text: 'Interactive dichotomous keys you can step through couplet by couplet, filtered by region.',
    cta: 'Browse keys'
  },
  {
    to: '/resources/tw/filter/dwc_otus',
    title: 'Specimen & occurrence data',
    text: 'Query Darwin Core records and download specimen data for any taxon in the database.',
    cta: 'Search records'
  },
  {
    to: '/resources/tw/filter/bibliography',
    title: 'Bibliography',
    text: 'Search the literature on Siphonaptera by author, year, title or taxon, and request PDFs you cannot access.',
    cta: 'Search literature'
  },
  {
    to: '/fleanews',
    title: 'Flea News',
    text: 'Browse newsletter issues by year or search their text for flea-related publications and topics.',
    cta: 'Browse Flea News'
  },
  {
    to: '/RecentTaxa',
    title: 'Recently added taxa',
    text: 'The latest names described or added to Fleas of the World, so you can keep up with new taxonomy.',
    cta: 'See what’s new'
  },
  {
    to: '/RecentReferences',
    title: 'Latest references',
    text: 'Publications most recently entered into the database and linked to their taxa.',
    cta: 'View additions'
  }
]
</script>
