<template>
  <InboxPage
    eyebrow="Get involved"
    title="Request a PDF"
    :subtitle="isContributionServiceConfigured
      ? 'Need a flea paper you cannot access? Send us the reference and an editor will email you a PDF if we have one.'
      : 'PDF requests are temporarily inactive while the website is under construction.'"
    :steps="steps"
    :related-links="[
      { label: 'Submit a paper', to: '/submit-publication' },
      { label: 'Report a correction', to: '/report-error' }
    ]"
  >
    <VSpinner v-if="isLoading" />
    <PdfRequestForm
      v-else
      :key="citation"
      :citation="citation"
      :source-id="sourceId"
      :doi="doi"
      :source="sourceRecord"
    />
  </InboxPage>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { makeAPIRequest } from '@/utils/request'
import InboxPage from './components/Inbox/InboxPage.vue'
import PdfRequestForm from './components/Inbox/PdfRequestForm.vue'
import { parseDoi } from './components/Inbox/doiLookup.js'
import { isContributionServiceConfigured } from './data/contributionSubmission.js'

const route = useRoute()
const sourceId = ref(/^\d+$/.test(String(route.query.source || '')) ? String(route.query.source) : '')
const doi = ref(parseDoi(route.query.doi))
const citation = ref('')
const sourceRecord = ref(null)
const isLoading = ref(false)

const steps = [
  {
    title: 'Find the reference',
    text: 'In the <a href="#/resources/tw/filter/bibliography" class="underline">bibliography</a> or on a taxon page, choose Request PDF next to a publication. For anything else, enter its DOI or citation below.'
  },
  {
    title: isContributionServiceConfigured ? 'Send the request' : 'Requests are paused',
    text: isContributionServiceConfigured
      ? 'Add your name and email, complete the spam check, and submit the form. Your contact details go privately to the editors.'
      : 'The request form will be available after the website is ready.'
  },
  {
    title: 'Get a reply',
    text: 'When requests are available, an editor will email you the PDF if a copy is available, or let you know if we do not have one.'
  }
]

onMounted(async () => {
  if (!sourceId.value) return
  isLoading.value = true
  try {
    const { data } = await makeAPIRequest.get(`/sources/${sourceId.value}`)
    citation.value = data?.cached || ''
    sourceRecord.value = data || null
    if (data?.doi) doi.value = parseDoi(data.doi)
    if (!citation.value) {
      sourceId.value = ''
      sourceRecord.value = null
    }
  } catch {
    sourceId.value = ''
    sourceRecord.value = null
  } finally {
    isLoading.value = false
  }
})
</script>
