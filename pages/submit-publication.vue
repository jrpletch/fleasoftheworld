<template>
  <InboxPage
    eyebrow="Get involved"
    title="Submit a missing publication"
    :subtitle="isContributionServiceConfigured
      ? 'Know of a paper on Siphonaptera that is not yet in Fleas of the World, perhaps your own? Send us the reference and we will add it.'
      : 'Publication submissions are temporarily inactive while the website is under construction.'"
    :steps="steps"
    :related-links="[
      { label: 'Request a PDF', to: '/request-pdf' },
      { label: 'Report a correction', to: '/report-error' }
    ]"
  >
    <PublicationForm :doi="doi" />
  </InboxPage>
</template>

<script setup>
import { useRoute } from 'vue-router'
import InboxPage from './components/Inbox/InboxPage.vue'
import PublicationForm from './components/Inbox/PublicationForm.vue'
import { parseDoi } from './components/Inbox/doiLookup.js'
import { isContributionServiceConfigured } from './data/contributionSubmission.js'

const doi = parseDoi(useRoute().query.doi)
const steps = [
  {
    title: 'Check the bibliography',
    text: 'Search the <a href="#/resources/tw/filter/bibliography" class="underline">bibliography</a> first: the work may already be there.'
  },
  { title: 'Give us the reference', text: 'Paste the DOI to check the bibliography. If no matching publication is found, use the DOI lookup to fill in the citation, or enter the details yourself. Tell us which flea taxa it treats if you can.' },
  {
    title: isContributionServiceConfigured ? 'We add it' : 'Submissions are paused',
    text: isContributionServiceConfigured
      ? 'An editor checks the work and adds it to Fleas of the World. We may write to you with questions.'
      : 'The submission service will be available after the website is ready.'
  }
]
</script>
