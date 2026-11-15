<template>
  <main class="inbox-page min-h-screen bg-base-background text-base-content">
    <header class="inbox-hero bg-primary text-primary-content">
      <div class="mx-auto max-w-[1720px] px-5 pb-10 pt-10 sm:px-8">
        <p v-if="eyebrow" class="text-[12px] font-bold uppercase tracking-[0.12em] text-primary-content/80">
          {{ eyebrow }}
        </p>
        <h1 class="mt-1 text-[32px] font-bold leading-tight tracking-tight sm:text-[36px]">{{ title }}</h1>
        <p class="mt-3 max-w-[760px] text-[18px] leading-[1.5] text-primary-content/85">
          {{ subtitle }}
        </p>
      </div>
    </header>

    <div class="inbox-content mx-auto grid max-w-[1720px] gap-7 px-5 pb-10 sm:px-8">
      <section class="min-w-0" aria-label="Form">
        <slot />
      </section>

      <aside v-if="steps.length" class="pt-1">
        <h2 class="text-[14px] font-bold uppercase tracking-wide text-primary-color dark:text-secondary-color">How it works</h2>
        <ol class="mt-4 space-y-5">
          <li v-for="(step, index) in steps" :key="step.title" class="flex gap-3">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[14px] font-bold text-primary-content">
              {{ index + 1 }}
            </span>
            <div class="min-w-0 pt-px">
              <h3 class="text-[16px] font-bold leading-[1.4]">{{ step.title }}</h3>
              <p class="mt-1 text-[14px] leading-[1.55] text-base-content/65" v-html="step.text" />
            </div>
          </li>
        </ol>
        <p class="mt-6 text-[13px] leading-[1.55] text-base-content/55">
          The form sends your details directly to the editors. Your e-mail is used for a reply.
        </p>
        <nav class="mt-5 flex flex-wrap gap-2.5" aria-label="Related pages">
          <RouterLink v-for="link in relatedLinks" :key="link.to" :to="link.to" class="rounded-full border border-base-border px-4 py-2.5 text-[13px] text-base-content/65 transition hover:bg-base-foreground">
            {{ link.label }}
          </RouterLink>
        </nav>
      </aside>
    </div>
  </main>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  steps: { type: Array, default: () => [] },
  relatedLinks: { type: Array, default: () => [] }
})
</script>

<style scoped>
.inbox-hero {
  background: linear-gradient(112deg, color-mix(in srgb, var(--tp-primary) 86%, black), var(--tp-primary));
}
.inbox-content {
  margin-top: -1.25rem;
}
@media (min-width: 900px) {
  .inbox-content { margin-top: 0; }
  .inbox-content { grid-template-columns: minmax(0, 1.5fr) minmax(20rem, 1fr); gap: 2rem; }
  .inbox-content > section { margin-top: -2rem; }
  .inbox-content > aside { padding-top: 0.5rem; }
}
</style>
