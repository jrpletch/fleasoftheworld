<template> 
  <section>

    <!-- Hero Header -->
    <div class="bg-gray-50 py-10">
      <div class="max-w-5xl mx-auto px-6 text-center">
        <h1 class="text-4xl sm:text-5xl font-bold mb-4">
          <i>Flea News</i>
        </h1>
      </div>
    </div>

    <!-- About Section -->
    <div class="max-w-5xl mx-auto px-6 py-5 space-y-8">
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-2xl font-semibold mb-4">About <i>Flea News</i></h2>
        <p class="text-gray-700 leading-relaxed">
          <i>Flea News</i> is a biannual newsletter, mainly bibliographic in nature, covering recent publications about or relating to fleas. 
          It was first published in 1974 by F.G.A.M. Smit who continued to publish it until his retirement in 1980. 
          Robert E. Lewis edited <i>Flea News</i> between 1980 and 2000. 
          After a seven year hiatus, Robert Bossard resumed publishing <i>Flea News</i> in 2007 and continues to this day. The complete run of <i>Flea News</i> is available below.
        </p>
      </div>
    </div>

    <!-- Controls -->
    <div class="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <label for="year-select" class="mr-2 font-medium">Select Year:</label>
        <select
          id="year-select"
          v-model="selectedYear"
          class="p-2 border rounded border-gray-300 focus:ring-2 focus:ring-black"
        >
          <option value="">All Years</option>
          <option v-for="year in uniqueYears" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>

      <input
        v-model="searchInput"
        type="text"
        placeholder="Search by text..."
        class="w-full sm:w-64 p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
      />
    </div>

    <!-- TILE VIEW (no search) -->
    <div
		v-if="!searchQuery"
	>
	<div
      class="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
    >
      <a
        v-for="issue in paginatedTiles"
        :key="`${issue.year}-${issue.month}-${issue.issue}`"
        :href="issue.pdf"
        target="_blank"
        class="bg-white rounded-xl shadow p-4 flex flex-col hover:shadow-lg hover:-translate-y-1 transition transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-black"
      >
        <img
          v-if="issue.thumbnail"
          :src="issue.thumbnail"
          class="w-full object-contain mb-3 rounded bg-gray-100"
        />

        <div class="font-semibold text-lg mb-1">
          {{ issue.year }} {{ issue.month }} · Number {{ issue.issue }}
        </div>

        <div class="text-gray-500 text-sm">
          Editor: {{ issue.editor }}
        </div>
      </a>
    </div>
	
	<!--Pagination-->
	<div
      v-if="totalPages > 1"
      class="max-w-5xl mx-auto px-6 py-6 flex justify-center items-center gap-2">
      <button
        @click="currentPage--"
        :disabled="currentPage === 1"
        class="px-3 py-1 border rounded bg-white hover:bg-gray-200 disabled:opacity-40">
        Previous
      </button>

      <button
        v-for="page in totalPages"
        :key="page"
        @click="currentPage = page"
        class="px-3 py-1 border rounded"
        :class="page === currentPage ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-200'">
        {{ page }}
      </button>

      <button
        @click="currentPage++"
        :disabled="currentPage === totalPages"
        class="px-3 py-1 border rounded bg-white hover:bg-gray-200 disabled:opacity-40">
        Next
      </button>
    </div>
</div>

    <!-- SEARCH RESULTS -->
    <div
      v-else
      class="max-w-5xl mx-auto px-6 py-6 space-y-4"
    >
      <div
        v-for="row in searchResults"
        :key="`${row.year}-${row.month}-${row.issue}`"
        class="bg-white rounded-xl shadow p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <span class="font-semibold">
              {{ row.year }} {{ row.month }} · Number {{ row.issue }}
            </span>
            <span class="text-gray-500 ml-2">
              Editor: {{ row.editor }}
            </span>
          </div>
          <a
            :href="row.pdf"
            target="_blank"
            class="px-3 py-1 bg-black text-white rounded hover:bg-gray-800 transition"
          >
            View PDF
          </a>
        </div>

        <div class="text-gray-700 mt-2 space-y-1">
          <p
            v-for="(snippet, i) in row.snippets"
            :key="i"
            v-html="snippet"
          ></p>
        </div>
      </div>

      <p
        v-if="searchResults.length === 0"
        class="text-center text-gray-500 mt-6"
      >
        No matching snippets found.
      </p>
    </div>

  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import issues from '@/assets/fleaNewsIssuesWithText.json'

const searchInput = ref('')
const searchQuery = ref('')
const selectedYear = ref('')

const currentPage = ref(1)
const perPage = 24

// Debounce search
let debounceTimeout
watch(searchInput, (val) => {
  clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    // Only trigger search if input has 3 or more characters
    if (val.trim().length >= 3 || val.trim().length === 0) {
      searchQuery.value = val.trim()
    } else {
      // Clear searchQuery if fewer than 3 letters
      searchQuery.value = ''
    }
  }, 300)
})

watch(selectedYear, () => {
	currentPage.value = 1
})

const monthOrder = {
  January: 1, February: 2, March: 3, April: 4,
  May: 5, June: 6, July: 7, August: 8,
  September: 9, October: 10, November: 11, December: 12
}

// Sorted descending for search results
const sortedIssues = [...issues].sort((a, b) => {
  const yearDiff = b.year - a.year
  if (yearDiff !== 0) return yearDiff

  const monthDiff = (monthOrder[b.month] || 0) - (monthOrder[a.month] || 0)
  if (monthDiff !== 0) return monthDiff

  return b.issue - a.issue
})

const uniqueYears = computed(() => {
  const years = [...new Set(sortedIssues.map(i => i.year))]
  return years.sort((a, b) => b - a)
})

const filteredIssues = computed(() => {
  return sortedIssues.filter(
    i => !selectedYear.value || i.year === Number(selectedYear.value)
  )
})

// Tiles sorted ascending for natural left→right order
const tilesSortedIssues = computed(() => {
  return filteredIssues.value
    .slice()
    .sort((a, b) => {
      const yearDiff = a.year - b.year
      if (yearDiff !== 0) return yearDiff

      const monthDiff = (monthOrder[a.month] || 0) - (monthOrder[b.month] || 0)
      if (monthDiff !== 0) return monthDiff

      return a.issue - b.issue
    })
})

const totalPages = computed(() => {
	return Math.ceil(tilesSortedIssues.value.length / perPage)
})

const paginatedTiles = computed(() => {
	const start = (currentPage.value - 1) * perPage
	const end = start + perPage
	return tilesSortedIssues.value.slice(start, end)
})

// Extract merged snippets
function extractSnippets(text, query, radius = 50, maxSnippets = 3) {
  if (!text || !query) return []

  const q = query.toLowerCase()
  const matches = []
  let startIndex = 0

  while (true) {
    const idx = text.toLowerCase().indexOf(q, startIndex)
    if (idx === -1) break
    matches.push({
      start: Math.max(0, idx - radius),
      end: Math.min(text.length, idx + query.length + radius)
    })
    startIndex = idx + query.length
  }

  if (!matches.length) return []

  matches.sort((a, b) => a.start - b.start)

  const merged = []
  let current = matches[0]

  for (let i = 1; i < matches.length; i++) {
    if (matches[i].start <= current.end) {
      current.end = Math.max(current.end, matches[i].end)
    } else {
      merged.push(current)
      current = matches[i]
    }
  }
  merged.push(current)

  const results = []

  for (let m of merged) {
    let snippet = text.slice(m.start, m.end)

    if (m.start > 0) snippet = '…' + snippet
    if (m.end < text.length) snippet += '…'

    const regex = new RegExp(`(${query})`, 'gi')
    snippet = snippet.replace(regex, '<mark>$1</mark>')

    results.push(snippet)

    if (results.length >= maxSnippets) break
  }

  return results
}

const searchResults = computed(() => {
  if (!searchQuery.value) return []

  const q = searchQuery.value.toLowerCase()
  const results = []

  sortedIssues.forEach(issue => {
    if (selectedYear.value && issue.year !== Number(selectedYear.value)) return
    if (!issue.text || !issue.text.toLowerCase().includes(q)) return

    const snippets = extractSnippets(issue.text, searchQuery.value)

    if (snippets.length) {
      results.push({
        ...issue,
        snippets
      })
    }
  })

  return results
})
</script>

<style scoped>
input:focus,
select:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.3);
}

mark {
  background-color: #f9d86a;
  color: black;
  font-weight: bold;
}
</style>