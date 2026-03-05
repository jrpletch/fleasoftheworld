<template>
	<section class="py-12">
		<div class="container mx-auto text-center">
			<h2 class="text-2xl font-semibold mb-4">
				Host species
			</h2>
			<div class="text-5xl font-bold">
				{{ HostCount.toLocaleString() }}
			</div>
		</div>
	</section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { makeAPIRequest } from '@/utils/request'

const HostCount = ref(0)

onMounted(() => {
	makeAPIRequest('/taxon_names.json',  {
			params: {
				page: 1,
				per: 1,
				validity: true,
				rank: ['NomenclaturalRank::Iczn::SpeciesGroup::Species'],
				taxon_name_id: [2708444],
				descendants: true
			}
		}).then((response) => {
			console.log('Response headers:', response.headers)
			const count = Number(response.headers?.['pagination-total'] || 0)
			HostCount.value = count
		}).catch((error) => {
			console.error('Failed to load species count:', error)
		})
	})
</script>