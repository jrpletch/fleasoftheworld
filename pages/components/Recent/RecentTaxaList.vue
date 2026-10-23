<template>
  <div>
    <div
      v-if="!compact"
      class="flex flex-wrap items-center justify-between gap-3"
    >
      <div
        class="inline-flex rounded-lg bg-base-foreground ring-1 ring-base-border/60 p-1 text-sm"
        role="group"
        aria-label="Filter by rank"
      >
        <button
          v-for="opt in RANKS"
          :key="opt.label"
          type="button"
          class="px-3 py-1.5 rounded-md font-medium transition-colors"
          :class="rank === opt.value ? 'bg-secondary text-secondary-content shadow' : 'text-base-content/70 hover:text-base-content'"
          :aria-pressed="rank === opt.value"
          @click="setRank(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <span
        v-if="total"
        class="text-sm text-base-content/55"
      >
        {{ total.toLocaleString('en-US') }} valid names in Fleas of the World
      </span>
    </div>

    <div
      class="rounded-2xl bg-base-foreground ring-1 ring-base-border/40 overflow-hidden"
      :class="compact ? '' : 'mt-5'"
    >
      <template v-if="!list.length && loading">
        <div
          v-for="n in (compact ? 5 : 8)"
          :key="n"
          class="h-14 border-b border-base-border/20 animate-pulse bg-base-muted/20"
        />
      </template>

      <p
        v-else-if="!list.length"
        class="p-6 text-base-content/60"
      >
        Nothing to show right now.
      </p>

      <template
        v-for="group in groups"
        :key="group.label"
      >
        <h3
          class="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-base-content/50 bg-base-background/60 border-b border-base-border/20"
        >
          {{ group.label }}
        </h3>
        <ul>
          <li
            v-for="item in group.items"
            :key="item.id"
            class="border-b border-base-border/20 last:border-b-0"
          >
            <component
              :is="item.otuId ? RouterLink : 'div'"
              :to="item.otuId ? { name: 'otus-id', params: { id: item.otuId } } : undefined"
              class="flex items-center gap-4 px-5 py-3"
              :class="item.otuId ? 'hover:bg-base-muted/25 transition-colors group' : ''"
            >
              <span
                class="flex-shrink-0 min-w-[5.5rem] whitespace-nowrap text-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                :class="rankClass(item.rank)"
                >{{ item.rank || 'name' }}</span
              >
              <span class="min-w-0 flex-1">
                <span
                  class="text-base-content [&_i]:italic"
                  v-html="item.cached_html"
                />
                <span class="text-base-content/55">{{ "\u00a0" + (item.cached_author_year || "") }}</span>
                <span
                  v-if="item.isHost"
                  class="ml-2 inline-block whitespace-nowrap rounded-md bg-blue-100 px-2 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-blue-800 dark:bg-blue-400/15 dark:text-blue-300"
                  >host</span
                >
              </span>
              <svg
                v-if="item.otuId"
                class="h-4 w-4 flex-shrink-0 text-base-content/30 group-hover:text-primary-color dark:group-hover:text-secondary-color transition-colors"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </component>
          </li>
        </ul>
      </template>
    </div>

    <div
      v-if="!compact && list.length < total"
      class="mt-5 text-center"
    >
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-base-content ring-1 ring-base-border hover:bg-base-muted/40 disabled:opacity-50"
        :disabled="loading"
        @click="loadMore"
      >
        {{ loading ? 'Loading…' : 'Show more' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { makeAPIRequest } from '@/utils/request'

const props = defineProps({
  per: { type: Number, default: 25 },
  compact: { type: Boolean, default: false }
})

const RANKS = [
  { label: 'All', value: '' },
  { label: 'Genera', value: 'NomenclaturalRank::Iczn::GenusGroup::Genus' },
  { label: 'Species', value: 'NomenclaturalRank::Iczn::SpeciesGroup::Species' }
]

// Siphonaptera OTU, same scope as the taxonomy page
const FLEA_OTU_ID = 1366469

const rank = ref('')
const fleaTaxonNameId = ref(null)
const list = ref([])
const total = ref(0)
const page = ref(0)
const loading = ref(false)

const RANK_CLASS = {
  species: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300',
  subspecies: 'bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300'
}
const rankClass = (r) => RANK_CLASS[r] || 'bg-base-muted/60 text-base-content/70'

const dateLabel = (iso) => {
  const d = new Date(iso)
  const today = new Date()
  const days = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const groups = computed(() => {
  const out = []
  list.value.forEach((item) => {
    const label = dateLabel(item.created_at)
    let g = out[out.length - 1]
    if (!g || g.label !== label) out.push((g = { label, items: [] }))
    g.items.push(item)
  })
  return out
})

// The taxon_names endpoint ignores ancestor_id, so check each name's ancestor chain.
const fleaCache = new Map()
function isFlea(id) {
  if (!fleaCache.has(id)) {
    fleaCache.set(
      id,
      makeAPIRequest
        .get('/taxon_names', { params: { taxon_name_id: [id], ancestors: true, per: 200 } })
        .then(({ data }) => data.some((t) => t.id === fleaTaxonNameId.value))
        .catch(() => true)
    )
  }
  return fleaCache.get(id)
}

async function load(next) {
  loading.value = true
  try {
    if (!fleaTaxonNameId.value) {
      const { data: otu } = await makeAPIRequest.get(`/otus/${FLEA_OTU_ID}`)
      fleaTaxonNameId.value = otu.taxon_name_id
    }

    const { data, headers } = await makeAPIRequest.get('/taxon_names', {
      params: {
        validity: true,
        recent: true,
        taxon_name_type: 'Protonym',
        recent_target: 'created_at',
        rank: rank.value ? [rank.value] : undefined,
        per: props.per,
        page: next
      }
    })
    total.value = Number(headers['pagination-total']) || 0

    let otus = []
    let fleaIds = new Set()
    if (data.length) {
      const ids = data.map((t) => t.id)
      const [otuRes, fleaFlags] = await Promise.all([
        makeAPIRequest.get('/otus', { params: { taxon_name_id: ids, per: data.length * 2 } }),
        Promise.all(ids.map(isFlea))
      ])
      otus = otuRes.data
      fleaIds = new Set(ids.filter((_, i) => fleaFlags[i]))
    }

    const items = data.map((t) => ({
      ...t,
      isHost: !fleaIds.has(t.id),
      otuId: otus.find((o) => o.taxon_name_id === t.id)?.id || null
    }))
    list.value = next === 1 ? items : [...list.value, ...items]
    page.value = next
  } catch {
    if (next === 1) list.value = []
  } finally {
    loading.value = false
  }
}

const loadMore = () => load(page.value + 1)
function setRank(value) {
  rank.value = value
  list.value = []
  load(1)
}

onMounted(() => load(1))
</script>
