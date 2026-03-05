<template>
  <section class="py-12 bg-gray-50 min-h-screen">
    <div class="container mx-auto">
      <h1 class="text-3xl sm:text-4xl font-bold text-center mb-8">
        Major Flea Collections
      </h1>

      <!-- Grid of collection cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-4 sm:px-6">
        <a
          v-for="collection in collections"
          :key="collection.id"
		  :href="collection.url"
		  target="_blank"
		  rel="noopener noreferrer"
          class="bg-white rounded-lg shadow-lg hover:shadow-2xl transition duration-300 p-4 flex flex-col items-center justify-center"
        >
          <img
            :src="collection.logo"
            :alt="collection.name"
            class="max-w-full max-h-32 object-contain mb-4"
          />
          <h2 class="text-lg font-semibold text-center">{{ collection.name }}</h2>
          <h3 class="text-md font-semibold text-center">{{ collection.institution }}</h3>
		  <p class="text-sm text-gray-500 text-center">{{ collection.location }}</p>
        </a>
      </div>
    </div>
  </section>
</template>

<script setup>
const collections = [
  {
    id: 1,
    name: 'Natural History Museum, London',
    logo: 'images/nhm.png',
    location: 'London, UK',
	url: 'https://www.nhm.ac.uk/'
  },
  {
    id: 2,
    name: 'National Museum of Natural History',
	institution: "Smithsonian Institution",
    logo: 'images/nmnh.png',
    location: 'Washington D.C., USA',
	url: 'https://naturalhistory.si.edu/'
  },
  {
    id: 3,
    name: 'Monte L. Bean Life Science Museum',
	institution: 'Brigham Young University',
    logo: 'images/byu.png',
    location: 'Provo, Utah, USA',
	url: 'https://lsm.byu.edu/'
  },
  {
    id: 4,
    name: 'Museum of the Zoological Insitute',
	institution: 'Russian Academy of Sciences',
    logo: 'images/zinras.png',
    location: 'St. Petersburg, Russia',
	url: 'https://www.zin.ru/museum/'
  },
  {
    id: 5,
    name: 'Museum of Southwestern Biology',
	institution: 'University of New Mexico',
    logo: 'images/msb.png',
    location: 'Albuquerque, New Mexico, USA',
	url: 'http://www.msb.unm.edu/'
  },
  {
    id: 6,
    name: 'Manter Laboratory of Parasitology',
	institution: 'University of Nebraska-Lincoln',
    logo: 'images/unl.png',
    location: 'Lincoln, Nebraska, USA',
	url: 'https://hwml.unl.edu/'
  },
  {
    id: 7,
    name: 'Wallis-Roughley Museum of Entomology',
	institution: 'University of Manitoba',
    logo: 'images/manitoba.png',
    location: 'Winnipeg, Manitoba, Canada',
	url: 'https://www.wallisroughley.ca/'
  },
  {
    id: 8,
    name: 'Canadian National Collection of Insects',
    logo: 'images/cnci.png',
    location: 'Ottawa, Ontario, Canada',
	url: 'https://agriculture.canada.ca/en/science/collections/canadian-national-collection-insects-arachnids-and-nematodes'
  },
  {
    id: 9,
    name: 'Field Museum of Natural History',
    logo: 'images/field.png',
    location: 'Chicago, Illinois, USA',
	url: 'https://www.fieldmuseum.org/'
  },
  {
    id: 10,
    name: 'Carnegie Museum of Natural History',
    logo: 'images/carnegie.png',
    location: 'Pittsburg, Pennsylvania, USA',
	url: 'https://carnegiemnh.org/'
  },
  {
    id: 11,
    name: 'Northern Museum of Zoology',
	institution: 'Northern Michigan University',
    logo: 'images/nmz.png',
    location: 'Marquette, Michigan, USA',
	url: 'https://nmu.edu/biology/northern-museum-zoology'
  },
  {
    id: 12,
    name: 'Denver Museum of Nature and Science',
    logo: 'images/dmns.png',
    location: 'Denver, Colorado, USA',
	url: 'https://www.dmns.org/'
  },
  // Add more collections here
]
</script>