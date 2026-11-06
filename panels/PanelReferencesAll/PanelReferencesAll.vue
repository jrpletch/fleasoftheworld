<template>
  <VCard>
    <VSpinner
      v-if="isLoading"
      logo-class="w-8 h-8"
      legend=""
    />
    <VCardHeader>
      <h2 class="text-md">References ({{ references.length }})</h2>
    </VCardHeader>
    <p
      v-if="loadError"
      class="p-4 text-sm text-base-content/60"
    >
      {{ loadError }}
    </p>
    <ul
      v-else
      class="max-h-[32rem] overflow-y-auto text-sm"
      tabindex="0"
      aria-label="References"
    >
      <li
        v-for="reference in references"
        :key="reference.key"
        class="border-b border-base-muted p-3 px-5"
      >
        <span v-html="sanitizeAndLinkifyHtml(reference.html)" />
        <VBadge
          v-for="type in reference.types"
          :key="type"
          class="ml-1"
          color="blue"
          shape="pill"
          size="sm"
          weight="normal"
          >{{ type }}</VBadge
        >
        <VBadge
          v-for="topic in reference.topics"
          :key="topic"
          class="ml-1"
          color="yellow"
          shape="pill"
          size="sm"
          weight="normal"
          >{{ topic }}</VBadge
        >
        <VBadge
          v-for="tag in reference.tags"
          :key="tag"
          class="ml-1"
          color="green"
          shape="pill"
          size="sm"
          weight="normal"
          >{{ tag }}</VBadge
        >
      </li>
      <li
        v-if="!isLoading && !references.length"
        class="p-4 text-base-content/60"
      >
        No references recorded.
      </li>
    </ul>
  </VCard>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { makeAPIRequest, sanitizeAndLinkifyHtml } from '@/utils'
import TaxonWorks from '@/modules/otus/services/TaxonWorks'
import { useOtuPageRequest } from '@/modules/otus/helpers/useOtuPageRequest'
import { useOtuStore } from '@/modules/otus/store/store'

const props = defineProps({
  otuId: {
    type: [Number, String],
    required: true
  },
  taxonId: {
    type: [Number, String],
    default: undefined
  }
})

const TYPE_LABELS = { Lead: 'Key' }

const store = useOtuStore()
const isLoading = ref(false)
const loadError = ref('')
const citationRefs = ref([])
const nameCitations = ref([])
const tagsByCitation = ref(new Map())

function textKey(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 80)
}

function citationReferences(items) {
  const bySource = new Map()

  for (const citation of items.flatMap((item) => item.citations || [])) {
    const id = citation.source?.id
    if (!id) continue

    if (!bySource.has(id)) {
      bySource.set(id, {
        key: `source-${id}`,
        html: citation.source.cached,
        year: citation.source.year ?? 0,
        types: new Set(),
        topics: new Set(),
        tags: new Set()
      })
    }

    const entry = bySource.get(id)
    const type = TYPE_LABELS[citation.citation_object_type] || citation.citation_object_type
    entry.types.add([type, citation.pages].filter(Boolean).join(':'))
    for (const topic of citation.topics || []) entry.topics.add(topic.name)
    for (const tag of tagsByCitation.value.get(citation.id) || []) entry.tags.add(tag)
  }

  return [...bySource.values()]
}

// Catalog sources carry no ids, so they are matched to citations by citation text.
const references = computed(() => {
  const merged = new Map()

  const nameItems = [
    {
      citations: nameCitations.value.map((citation) => ({
        ...citation,
        citation_object_type: 'Nomenclature'
      }))
    }
  ]

  for (const entry of [
    ...citationReferences(citationRefs.value),
    ...citationReferences(nameItems)
  ]) {
    const key = textKey(entry.html)
    const existing = merged.get(key)

    if (existing) {
      for (const field of ['types', 'topics', 'tags']) {
        entry[field].forEach((value) => existing[field].add(value))
      }
    } else {
      merged.set(key, entry)
    }
  }

  for (const html of store.catalog.sources || []) {
    const key = textKey(html)
    if (!key) continue

    if (!merged.has(key)) {
      const year = Number(String(html).match(/\((\d{4})/)?.[1]) || 0
      merged.set(key, {
        key: `catalog-${key}`,
        html,
        year,
        types: new Set(),
        topics: new Set(),
        tags: new Set()
      })
    }
    const existing = merged.get(key)
    if (![...existing.types].some((type) => type.startsWith('Nomenclature'))) {
      existing.types.add('Nomenclature')
    }
  }

  return [...merged.values()]
    .map((entry) => ({
      ...entry,
      types: [...entry.types],
      topics: [...entry.topics],
      tags: [...entry.tags]
    }))
    .sort((a, b) => a.year - b.year || textKey(a.html).localeCompare(textKey(b.html)))
})

async function loadTags(citationIds) {
  const result = new Map()
  const ids = [...new Set(citationIds)]

  for (let i = 0; i < ids.length; i += 150) {
    const params = new URLSearchParams({ tag_object_type: 'Citation', per: '500' })
    ids.slice(i, i + 150).forEach((id) => params.append('tag_object_id[]', id))
    const { data } = await makeAPIRequest.get(`/tags?${params.toString()}`)

    for (const tag of data) {
      const name = tag.keyword?.name
      if (!name) continue
      if (!result.has(tag.tag_object_id)) result.set(tag.tag_object_id, [])
      result.get(tag.tag_object_id).push(name)
    }
  }

  return result
}

async function loadNameCitations() {
  if (!props.taxonId) return []

  const params = new URLSearchParams({ per: '200' })
  params.append('citation_object_type[]', 'TaxonName')
  params.append('citation_object_id[]', props.taxonId)
  params.append('extend[]', 'source')
  const { data } = await makeAPIRequest.get(`/citations?${params.toString()}`)
  return data
}

onMounted(async () => {
  isLoading.value = true

  try {
    const [{ data }, names] = await Promise.all([
      useOtuPageRequest('panel:references-all', () => TaxonWorks.getOtuCitations(props.otuId)),
      loadNameCitations()
    ])

    const allIds = [...data.flatMap((item) => item.citations || []), ...names].map((c) => c.id)
    // Tags are optional extras, so a tag failure should not hide the references.
    tagsByCitation.value = await loadTags(allIds).catch(() => new Map())
    citationRefs.value = data
    nameCitations.value = names.filter((citation) => citation.source)
  } catch {
    loadError.value = 'References could not be loaded.'
  } finally {
    isLoading.value = false
  }
})
</script>
