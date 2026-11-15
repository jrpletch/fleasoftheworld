<template>
  <div class="container mx-auto box-border">
    <h1 class="text-4xl px-4 md:px-0 mt-6 mb-6 font-bold">Bibliography</h1>
    <ClientOnly>
      <VSpinner
        v-if="isLoading"
        full-screen
      />
    </ClientOnly>
    <VCard class="mb-4">
      <VCardContent>
        <div
          class="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-2 text-sm"
        >
          <div class="flex flex-col w-full">
            <label>In citation</label>
            <InputText
              class="w-full"
              type="text"
              placeholder='Search anywhere in the citation... for example: "Charles Darwin Archives"'
              v-model="parameters.query_term"
              @keypress.enter="() => loadList()"
            />
          </div>
          <div class="flex flex-col w-full md:w-96">
            <label>Author(s)</label>
            <InputText
              class="w-full"
              type="text"
              placeholder="Type..."
              v-model="parameters.author"
              @keypress.enter="() => loadList()"
            />
          </div>
          <div class="w-full md:w-auto">
            <span>Published between:</span>
            <div class="flex flex-row gap-2">
              <YearPicker
                v-model="parameters.year_start"
                :min="MIN_YEAR"
                :max="MAX_YEAR"
              />
              <VSlider
                class="w-full md:w-64"
                :min="MIN_YEAR"
                :max="MAX_YEAR"
                v-model:start="parameters.year_start"
                v-model:end="parameters.year_end"
              />
              <YearPicker
                v-model="parameters.year_end"
                :min="MIN_YEAR"
                :max="MAX_YEAR"
              />
            </div>
          </div>
          <div class="flex flex-row gap-2 md:self-end">
            <VButton
              @click="() => loadList()"
              >Search</VButton
            >
            <VButton
              @click="() => reset()"
            >
              Reset
            </VButton>
          </div>
        </div>
      </VCardContent>
    </VCard>

    <VCard>
      <VCardContent>
        <div class="flex flex-row justify-between items-center mb-4">
          <div class="flex flex-col md:flex-row gap-3 md:items-center">
            <VPagination
              v-model="pagination.page"
              :total="pagination.total"
              :per="pagination.per"
              @update:modelValue="
                (page) => {
                  loadList(page)
                }
              "
            />
            <VPaginationInfo :pagination="pagination" />
          </div>
          <DropdownMenu :request="requestData" />
        </div>
        <VTable>
          <VTableHeader>
            <VTableHeaderRow>
              <VTableHeaderCell class="w-2" />
              <VTableHeaderCell> Sources </VTableHeaderCell>
            </VTableHeaderRow>
          </VTableHeader>
          <VTableBody>
            <VTableBodyRow
              v-for="item in list"
              :key="item.id"
            >
              <VTableBodyCell
                class="pr-1"
                title="Show OTUs"
              >
                <OtuModal
                  :source-id="item.id"
                  :label="item.cached"
                />
              </VTableBodyCell>
              <VTableBodyCell
                class="break-all"
              >
                <span v-html="sanitizeAndLinkifyHtml(item.cached)" />
                <RouterLink
                  v-if="item.hasAttachedCitations"
                  :to="`/sources/${item.id}`"
                  class="ml-2 inline-flex text-xs font-semibold text-primary-color hover:underline dark:text-secondary-color"
                >
                  Source details
                </RouterLink>
              </VTableBodyCell>
            </VTableBodyRow>
          </VTableBody>
        </VTable>
        <div class="flex flex-col md:flex-row gap-3 md:items-center mt-4">
          <VPagination
            v-model="pagination.page"
            :total="pagination.total"
            :per="pagination.per"
            @update:modelValue="
              (page) => {
                loadList(page)
              }
            "
          />
          <VPaginationInfo :pagination="pagination" />
        </div>
      </VCardContent>
    </VCard>
  </div>
</template>

<script setup>
import { ref, onBeforeMount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getPagination } from '@/modules/bibliography/utils'
import { makeAPIRequest, sanitizeAndLinkifyHtml } from '@/utils'
import DropdownMenu from '@/modules/bibliography/components/DropdownMenu.vue'
import YearPicker from '@/modules/bibliography/components/YearPicker.vue'
import VSlider from '@/modules/bibliography/components/VSlider.vue'
import OtuModal from '@/modules/bibliography/components/OtuModal.vue'
import { fetchSourceCitationCounts } from '../../../data/sourceProfile.js'

const PER = 50
const MIN_YEAR = 1650
const MAX_YEAR = new Date().getFullYear()

const route = useRoute()
const router = useRouter()

const parameters = ref({})
const list = ref([])
const isLoading = ref(false)
const pagination = ref({ page: 1, total: 0, per: PER })
const requestData = ref()
let listRequestId = 0

async function loadList(page = 1) {
  const requestId = ++listRequestId
  isLoading.value = true

  try {
    const { data, headers, request } = await makeAPIRequest.get('/sources', {
      params: {
        in_project: true,
        page,
        per: pagination.value.per,
        ...parameters.value
      }
    })
    if (requestId !== listRequestId) return

    pagination.value = getPagination(headers)
    const rows = (data || []).map((source) => ({ ...source, hasAttachedCitations: false }))
    list.value = rows

    requestData.value = {
      data,
      url: request.responseURL
    }

    setQuery()
    fetchSourceCitationCounts(rows.map((source) => source.id)).then((counts) => {
      if (requestId !== listRequestId) return
      list.value = rows.map((source) => ({
        ...source,
        hasAttachedCitations: (counts.get(String(source.id)) || 0) > 0
      }))
    })
  } catch {
    // Keep the current results if a later search fails.
  } finally {
    if (requestId === listRequestId) isLoading.value = false
  }
}

function setParameters(data = {}) {
  parameters.value = {
    year_start: Number(data.year_start || 1650),
    year_end: Number(data.year_end || 2025),
    author: data.author,
    query_term: data.query_term
  }
}

function setPagination(data = {}) {
  pagination.value = {
    page: Number(data.page) || 1,
    total: 0,
    per: PER
  }
}

function reset() {
  setParameters()
  setPagination()
  loadList()
}

function setQuery() {
  router.push({
    query: { ...parameters.value, page: pagination.value.page }
  })
}

onBeforeMount(() => {
  setParameters(route.query)
  setPagination(route.query)
  loadList(pagination.value.page)
})
</script>
