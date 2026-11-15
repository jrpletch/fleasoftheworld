<template>
  <div class="turnstile-challenge" aria-label="Spam protection">
    <div v-if="isContributionServiceConfigured" ref="container" />
    <p v-else class="text-[11px] leading-relaxed text-base-content/60" role="status">
      Online submissions are currently inactive while the website is under construction.
    </p>
    <p v-if="loadError" class="mt-1 text-[9px] text-red-700 dark:text-red-300" role="status">{{ loadError }}</p>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { isContributionServiceConfigured } from '../../data/contributionSubmission.js'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const container = ref(null)
const loadError = ref('')
let widgetId

function reset() {
  if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId)
  emit('update:modelValue', '')
  loadError.value = ''
}

defineExpose({ reset })

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!window.__fowTurnstileScript) {
    window.__fowTurnstileScript = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.onload = () => resolve(window.turnstile)
      script.onerror = () => reject(new Error('The spam check could not be loaded. Refresh the page and try again.'))
      document.head.appendChild(script)
    })
  }
  return window.__fowTurnstileScript
}

onMounted(async () => {
  if (!isContributionServiceConfigured) return
  try {
    const turnstile = await loadTurnstile()
    if (!container.value) return
    widgetId = turnstile.render(container.value, {
      sitekey: siteKey,
      action: 'contribution',
      callback: (token) => emit('update:modelValue', token),
      'expired-callback': () => emit('update:modelValue', ''),
      'error-callback': () => {
        emit('update:modelValue', '')
        loadError.value = 'The spam check had a problem. Please retry it.'
      }
    })
  } catch (error) {
    loadError.value = error.message || 'The spam check could not be loaded.'
  }
})

onBeforeUnmount(() => {
  if (widgetId !== undefined && window.turnstile) window.turnstile.remove(widgetId)
  if (props.modelValue) emit('update:modelValue', '')
})
</script>
