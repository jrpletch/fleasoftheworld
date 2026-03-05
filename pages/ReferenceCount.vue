<template>
	<section class="py-12">
		<div class="container mx-auto text-center">
			<h2 class="text-2xl font-semibold mb-4">
				References
			</h2>
			<div class="text-5xl font-bold">
				{{ ReferenceCount.toLocaleString() }}
			</div>
		</div>
	</section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { makeAPIRequest } from '@/utils/request'

const ReferenceCount = ref(0)

onMounted(() => {
	makeAPIRequest('sources.json',  {
			params: {
				page: 1,
				per: 1,
				in_project: true
			}
		}).then((response) => {
			console.log('Response headers:', response.headers)
			const count = Number(response.headers?.['pagination-total'] || 0)
			ReferenceCount.value = count
		}).catch((error) => {
			console.error('Failed to load references count:', error)
		})
	})
</script>