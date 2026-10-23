<template>
  <section class="bg-base-background">
    <!-- Hero Header -->
    <div class="bg-base-background py-10">
      <div class="max-w-5xl mx-auto px-6 text-center">
        <h1 class="text-4xl sm:text-5xl font-bold mb-4">
          {{ pageTitle }}
        </h1>
      </div>
    </div>

    <div class="max-w-5xl mx-auto px-6 py-5 space-y-8">
      <article class="bg-base-foreground rounded-xl shadow p-8">
        <h2 class="text-2xl font-semibold mb-4">Dig deeper</h2>
        <p class="leading-relaxed">
          Please contact us if you need extended access to the data underlying here.
          The TaxonWorks interfaces used to curate these data include wide range of
          additional filtering, reporting, and curatorial functionality. With a little
          training from us we'd be happy to provide you access to this additional
          functionality. Over time we expect this site to gradually mirror that
          extended functionality.
        </p>
      </article>

      <article class="bg-base-foreground rounded-xl shadow p-8">
        <h2 class="text-2xl font-semibold mb-4">Data sources</h2>
        <div class="space-y-4 leading-relaxed">
          <p>
            This database brings together several datasets on flea taxonomy and biology
            and presents them as a unified, searchable, and publically accessible
            database.
          </p>
          <p>
            The <strong>Robert E. Lewis World Species (Flea) List</strong> (LWSL),
            maintained by Michael Hastriter and Robert Bossard, is the authoritative
            source for flea taxonomy. Robert E. Lewis began compiling a list of flea
            species in 1980 and informally distributed it to flea researchers along
            with <em>Flea News</em>. After Lewis's death, Michael Hastriter and Robert
            Bossard converted the LWSL into an Excel spreadsheet. The list tracks valid
            species of Siphonaptera and synonymies.
          </p>
          <p>
            The <strong>PARHOST</strong> database, compiled by Sergei Medvedev,
            aggregates host association records and geographic distribution for the
            majority of flea species.
          </p>
          <p>
            <strong><em><a href="fleasoftheworld/FleaNews">Flea News</a></em></strong> is an important
            source of bibliographic information on fleas, tracking papers published on
            fleas twice yearly since 1974.
          </p>
          <p>
            The <strong>Illustrated Catalogues of the Rothschild Collection of Fleas</strong>
            (1953–1983) are the most comprehensive published source on global flea
            diversity. Though out of date, the compilation of records from the British
            Museum alongside numerous keys, figures, and taxonomic diagnoses make them
            an essential source on Siphonaptera.
          </p>
        </div>
      </article>

      <article class="bg-base-foreground rounded-xl shadow p-8">
        <h2 class="text-2xl font-semibold mb-4">Georeferencing</h2>
        <p class="leading-relaxed">
          Georeferences used for collection objects and type specimens are approximate
          and do not represent exact collection localities, unless accompanied by GPS
          coordinates in the original publication or dataset. While every effort has
          been made to trace localities, errors may still be present. If you see what
          appears to be an error, please let us know!
        </p>
      </article>

      <article class="bg-base-foreground rounded-xl shadow p-8">
        <h2 class="text-2xl font-semibold mb-4">Contact</h2>
        <p class="leading-relaxed">
          If you have a question, want to report new data relevant to the project, or
          have error our preferred means of contact is to file an issue on
          the <a :href="projectTrackerUrl">project tracker</a>.
        </p>
      </article>

      <article class="bg-base-foreground rounded-xl shadow p-8">
        <h2 class="text-2xl font-semibold mb-4">Team</h2>
        <p class="leading-relaxed mb-4">
          <em>Please contact us if you would like to join this effort.</em>
        </p>
        <p class="leading-relaxed mb-3">Made possible by the wonderful:</p>
        <ul class="list-disc pl-6 space-y-2">
          <li>Josh R. Pletcher</li>
          <li>Mike Hastriter</li>
          <li>Bob Bossard</li>
          <li>Sergei Medvedev</li>
          <li>Mackenzie Kwak</li>
          <li>Lance Durden</li>
          <li>Sonja Matthee</li>
        </ul>
      </article>

      <article class="bg-base-foreground rounded-xl shadow p-8">
        <h2 class="text-2xl font-semibold mb-4">Citing</h2>
        <ul class="list-disc pl-6 space-y-3 leading-relaxed">
          <li>
            <strong>This website:</strong> {{ websiteCitation }}
            <a :href="websiteUrl">{{ websiteUrl }}</a>
          </li>
          <li>
            <strong>Individual taxon pages:</strong> See the citation at the bottom of
            each page.
          </li>
        </ul>
      </article>

      <article class="bg-base-foreground rounded-xl shadow p-8">
        <h2 class="text-2xl font-semibold mb-4">Data</h2>
        <p class="leading-relaxed">
          Data for these pages is collaboratively curated online in a
          <a :href="taxonWorksUrl">TaxonWorks</a> project. All data behind this site
          served as JSON through calls to a
          <a :href="taxonWorksApiUrl">TaxonWorks API</a>. You can follow along by using
          the Console of your browser to explore the Network tab.
        </p>
      </article>

      <article class="bg-base-foreground rounded-xl shadow p-8">
        <h2 class="text-2xl font-semibold mb-4">Technical</h2>
        <p class="leading-relaxed">
          Want to create your own site? This website is built completely on open-source
          software. There is a <a :href="siteTemplateUrl">site template</a> with more
          information. Data are curated in a <a :href="taxonWorksUrl">TaxonWorks</a>
          project then shared via a
          <a :href="taxonWorksApiUrl">TaxonWorks API</a>. Come
          <a :href="communityUrl">chat</a> with the TaxonWorks community at any time.
        </p>
      </article>

      <article class="bg-base-foreground rounded-xl shadow p-8">
        <h2 class="text-2xl font-semibold mb-4">Copyright</h2>
        <p class="leading-relaxed"><em>{{ copyrightNotice }}</em></p>
      </article>
    </div>
  </section>
</template>

<script setup>
const pageTitle = 'About'
const websiteCitation =
  'Pletcher, J.R., M.W. Hastriter, R. Bossard, S.G. Medvedev, M.L. Kwak, & L.A. Durden. 2026. Fleas of the World. Accessed [insert date here]. Available at'
const websiteUrl = 'https://jrpletch.github.io/fleasoftheworld/#/'
const projectTrackerUrl = 'https://github.com/our/project/tracker'
const taxonWorksUrl = 'https://taxonworks'
const taxonWorksApiUrl = 'https://api.taxonworks.org'
const siteTemplateUrl = 'https://github.com/SpeciesFileGroup/<something>'
const communityUrl = 'https://gitter.im/SpeciesFileGroup/taxonworks'
const copyrightNotice =
  'All content is CC 0 so that it maybe be shared throughout the world in places like Wikipedia.'
</script>
