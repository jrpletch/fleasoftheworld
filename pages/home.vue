<template>
	<main class="home-page bg-base-background">
	<HomeHero />
	<HomeStats />
	<HomeExplore />
	<HomeAbout />
	<HomeNews />
  </main>
</template>

<script setup>
import HomeHero from './components/Home/HomeHero.vue'
import HomeStats from './components/Home/HomeStats.vue'
import HomeExplore from './components/Home/HomeExplore.vue'
import HomeAbout from './components/Home/HomeAbout.vue'
import HomeNews from './components/Home/HomeNews.vue'
</script>

<style>
.home-page,
.home-page *,
.home-page *::before,
.home-page *::after {
	box-sizing: border-box;
}
</style>