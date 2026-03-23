<template>
  <div class="h-full">
    <SectionLandscape />
    <SectionData />
    <SectionDescription />	
	<div class="max-w-screen-2xl mx-auto px-6 my-12">
		<div class="flex flex-col md:flex-row gap-6">
		  <div class="flex-1">
			<PanelDescendants
			  :otuId="1366469"
			  title="Explore flea taxonomy" />
		  </div>

		  <div class="flex-1">
			<PanelDescendants
			  :otuId="1702978"
			  title="Explore host taxonomy" />
		  </div>
		</div>
	</div>
    <SectionAnnouncements />
    <SectionTerms />
  </div>
</template>

<script setup>
import PanelDescendants from '../src/modules/otus/components/Panel/PanelDescendants/PanelDescendants.vue';
</script>