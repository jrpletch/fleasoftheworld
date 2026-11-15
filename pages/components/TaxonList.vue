<template>
  <section>
    <h2 class="text-lg font-semibold">
      {{ title }}
      <span
        v-if="taxa"
        class="font-normal text-base-content/60"
      >
        ({{ taxa.length }})
      </span>
    </h2>
    <p
      v-if="note"
      class="mt-1 text-xs text-base-content/55"
    >
      {{ note }}
    </p>
    <p
      v-if="loading"
      class="mt-2 text-sm text-base-content/60"
      role="status"
    >
      Loading…
    </p>
    <p
      v-else-if="!taxa?.length"
      class="mt-2 text-sm text-base-content/60"
    >
      {{ empty }}
    </p>
    <template v-else>
      <ul
        class="mt-2 space-y-1 text-sm"
        :class="taxa.length > SCROLL_THRESHOLD ? 'max-h-96 overflow-y-auto overscroll-contain pr-2' : ''"
        :tabindex="taxa.length > SCROLL_THRESHOLD ? 0 : undefined"
        :aria-label="taxa.length > SCROLL_THRESHOLD ? `${title} list` : undefined"
      >
        <li
          v-for="taxon in visible"
          :key="taxon.id"
          class="flex flex-wrap items-baseline gap-x-2"
        >
          <RouterLink
            v-if="taxon.otuId"
            :to="`/otus/${taxon.otuId}/overview`"
            class="text-primary-color hover:underline dark:text-secondary-color"
          >
            <span v-html="taxon.html" />
          </RouterLink>
          <span
            v-else
            v-html="taxon.html"
          />
          <span class="text-base-content/70">{{ taxon.authorYear }}</span>
          <span
            v-if="!taxon.valid && taxon.validName"
            class="text-base-content/70"
          >
            (= <RouterLink
              v-if="taxon.validOtuId"
              :to="`/otus/${taxon.validOtuId}/overview`"
              class="text-primary-color hover:underline dark:text-secondary-color"
              v-html="taxon.validName"
            /><span v-else v-html="taxon.validName" />
            <span v-if="taxon.validNameAuthorYear" class="ml-1">{{ taxon.validNameAuthorYear }}</span>
            )
          </span>
        </li>
      </ul>
      <button
        v-if="taxa.length > LIMIT"
        type="button"
        class="mt-2 text-xs font-medium text-primary-color hover:underline dark:text-secondary-color"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Show fewer' : `Show all ${taxa.length}` }}
      </button>
    </template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

const LIMIT = 25
const SCROLL_THRESHOLD = 15

const props = defineProps({
  title: { type: String, required: true },
  taxa: { type: Array, default: null },
  loading: { type: Boolean, default: false },
  empty: { type: String, required: true },
  note: { type: String, default: '' }
})

const expanded = ref(false)
const visible = computed(() =>
  expanded.value ? props.taxa : props.taxa.slice(0, LIMIT)
)
</script>
