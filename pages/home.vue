<template>
  <section>
    <figure class="relative w-full h-[500px] sm:h-[500px] overflow-hidden m-0">
		<img
			src="../images/NK317589.F1_Mesopsylla_habitus.png"
			alt="NK317589.F1 Mesopsylla hebes"
			class="w-full h-96 sm:h-[500px] object-cover"
		/>
	<div class="absolute inset-0 bg-black/30"></div>
	
	<div class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-4">
        <h1 class="text-4xl sm:text-6xl lg:text-7xl font-bold text-white drop-shadow-lg">
			Fleas of the World
		</h1>
		
		<p class="text-lg sm:text-2xl text-white/90 max-w-2xl">
			A comprehensive database of global flea diversity
		</p>
		
        <div class="w-full max-w-lg mt-4 p-3 bg-white/20 backdrop-blur-md rounded-xl text-left">
            <AutocompleteOtu
              autofocus
              class="w-full"
              placeholder="Search by taxon name..."
            />
        </div>
	</div>
		<figcaption class="absolute bottom-4 right-6 text-sm text-white">
			NK317589.F1 <i>Mesopsylla hebes</i>
		</figcaption>
	</figure>
 </section>
 
<section class="py-5 bg-gray-50"> 
  <div class="max-w-6xl mx-auto px-6">
	<p class="text-lg leading-relaxed text-gray-700">
				Fleas are ectoparasitic holometabolous insects in the Order Siphonaptera. Several species of fleas are important in human and veterinary medicine, most notably as vectors of plague. Fleas are found on all seven continents, including Antarctica, and are primarily associated with small mammals. Other species of fleas are associated with birds, humans, carnivorans and ungulates. Unlike other ectoparasitic insects such as lice, many species of fleas spend a significant amount of time off the host in burrows or nests.
	</p>
  </div>
 </section>
 
 <section class="bg-gray-50 py-auto">
	<div class="max-w-6xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-3 gap-auto text-center">
		<!-- Species statistic -->
		<SpeciesCount />
		<!-- Host statistic -->
		<HostCount />
		<!-- Reference statistic -->
		<ReferenceCount />
	</div>
 </section>
  
  
</template>

<script setup>
import SpeciesCount from './SpeciesCount.vue'
import HostCount from './HostCount.vue'
import ReferenceCount from './ReferenceCount.vue'
</script>