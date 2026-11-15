<template>
  <main class="processor-page">
    <header class="page-heading">
      <p class="eyebrow">Research tools</p>
      <h1>PDF processor</h1>
      <p>Review publication metadata, index flea names, and prepare specimen records for TaxonWorks import.</p>
    </header>

    <section class="panel upload-panel">
      <div class="panel-heading">
        <div>
          <h2>1. Open a publication</h2>
          <p>Your PDF is processed in this browser and is not uploaded to Fleas of the World.</p>
        </div>
        <button v-if="file" class="secondary-button" type="button" @click="clearDocument">Clear document</button>
      </div>
      <label class="file-drop" :class="{ 'is-drag-over': isDragging }" @dragenter.prevent="isDragging = true" @dragover.prevent="isDragging = true" @dragleave="handleDragLeave" @drop.prevent="handleDrop">
        <input type="file" accept="application/pdf,.pdf" @change="selectFile">
        <span class="file-icon">↑</span>
        <strong>{{ file ? file.name : 'Choose a PDF to process' }}</strong>
        <span v-if="!file">{{ isDragging ? 'Release to open the PDF' : 'Drag and drop a PDF here, or click to browse' }}</span>
        <span>{{ file ? `${formatBytes(file.size)} · ${pages.length} pages` : 'Select a file from your device' }}</span>
      </label>
      <p v-if="error" class="notice error-notice" role="alert">{{ error }}</p>
      <div v-if="pages.length" class="document-summary">
        <span class="status-dot" :class="missingTextPages.length ? 'status-warning' : 'status-ready'"></span>
        <span v-if="missingTextPages.length">{{ missingTextPages.length }} page(s) have little or no selectable text and may need OCR.</span>
        <span v-else>Selectable text found on all pages. This check cannot tell whether the text came from OCR.</span>
      </div>
      <div v-if="missingTextPages.length && activeStep === 'names'" class="ocr-controls">
        <p>OCR uses the English language model, downloaded by Tesseract.js on first use. OCR text stays in this browser.</p>
        <button class="primary-button" type="button" :disabled="isOcrRunning" @click="runOcr">
          {{ isOcrRunning ? `Recognizing pages… ${ocrPercent}%` : `Run OCR on ${missingTextPages.length} page(s)` }}
        </button>
      </div>
      <div v-if="metadataOcrPageNumbers.length && activeStep === 'metadata'" class="ocr-controls">
        <p>Run OCR across the document to make text and word positions available for metadata matching.</p>
        <button class="secondary-button" type="button" :disabled="isOcrRunning || isFindingMetadataMatches" @click="runMetadataOcr">
          {{ isOcrRunning ? `Reading pages… ${ocrPercent}%` : metadataOcrPageNumbers.length === pages.length ? 'OCR all pages' : `OCR remaining ${metadataOcrPageNumbers.length} page(s)` }}
        </button>
      </div>
    </section>

    <section v-if="file" class="results-grid">
      <section class="panel pdf-panel">
        <div class="panel-heading">
          <div><h2>PDF preview</h2><p v-if="selectedAppearance">Selected occurrence: {{ selectedAppearance.gnName }} <span v-if="selectedAppearance.page">· page {{ selectedAppearance.page }}</span></p></div>
          <div class="pdf-toolbar">
            <div class="first-page-controls"><button class="secondary-button mark-first-page-button" type="button" :disabled="!previewPage" :aria-pressed="firstPageNumber === previewPage" @click="markFirstPage">Mark first page</button><span v-if="firstPageNumber != null" class="first-page-badge">First page: PDF {{ firstPageNumber }}</span></div>
            <div class="pdf-toolbar-control-row">
              <div class="preview-navigation"><button class="secondary-button pdf-tool-icon" type="button" :disabled="!previewPage || previewPage <= 1" aria-label="Previous PDF page" title="Previous PDF page" @click="goToPreviewPage(previewPage - 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button><span>{{ previewPage || '—' }} / {{ pages.length }}</span><button class="secondary-button pdf-tool-icon" type="button" :disabled="!previewPage || previewPage >= pages.length" aria-label="Next PDF page" title="Next PDF page" @click="goToPreviewPage(previewPage + 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button></div>
              <div class="preview-zoom-controls" aria-label="PDF zoom controls"><button class="secondary-button pdf-tool-icon" type="button" :disabled="previewZoom <= 0.5" aria-label="Zoom out" title="Zoom out" @click="adjustPreviewZoom(-0.25)">−</button><span>{{ Math.round(previewZoom * 100) }}%</span><button class="secondary-button pdf-tool-icon" type="button" :disabled="previewZoom >= 3" aria-label="Zoom in" title="Zoom in" @click="adjustPreviewZoom(0.25)">+</button></div>
              <button class="secondary-button pdf-tool-icon" type="button" aria-label="Rotate page counterclockwise" title="Rotate page counterclockwise" :disabled="isEditingPdf || !pdfEditor" @click="rotateCurrentPage(-90)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8a8 8 0 1 1-1 8M5 8V3m0 5h5" /></svg></button>
              <button class="secondary-button pdf-tool-icon" type="button" aria-label="Rotate page clockwise" title="Rotate page clockwise" :disabled="isEditingPdf || !pdfEditor" @click="rotateCurrentPage(90)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a8 8 0 1 0 1 8M19 8V3m0 5h-5" /></svg></button>
              <button class="remove-page-button pdf-tool-icon" type="button" aria-label="Remove current page" title="Remove current page" :disabled="isEditingPdf || !pdfEditor || pages.length <= 1" @click="removeCurrentPage"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 3v7m4-7v7" /></svg></button>
              <button class="primary-button pdf-tool-icon" type="button" aria-label="Download edited PDF" title="Download edited PDF" :disabled="isEditingPdf || !currentPdfBytes" @click="downloadEditedPdf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" /></svg></button>
            </div>
        </div>
        </div>
        <p v-if="pdfEditError" class="notice error-notice" role="alert">{{ pdfEditError }}</p>
        <div v-if="pdf" ref="previewSurface" class="pdf-page-surface" :class="{ 'is-rendering': isRenderingPage }" @wheel="handlePreviewWheel">
          <canvas ref="pdfCanvas" aria-label="Rendered PDF page"></canvas>
          <div v-if="highlightBounds" ref="highlightFocus" class="pdf-highlight-focus" :style="{ left: `${highlightBounds.left}px`, top: `${highlightBounds.top}px`, width: `${highlightBounds.width}px`, height: `${highlightBounds.height}px` }"></div>
          <div v-for="(rect, index) in highlightRects" :key="`${previewPage}-${index}`" class="pdf-highlight" :style="{ left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` }"></div>
          <div v-for="(rect, index) in searchHighlightRects" :key="`search-${previewPage}-${index}`" class="pdf-search-highlight" :style="{ left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` }"></div>
          <p v-if="isRenderingPage" class="rendering-label">Rendering page…</p>
        </div>
        <p v-if="highlightRects.length" class="highlight-note">Yellow marks show the selected name appearance.</p>
        <p v-else-if="searchHighlightRects.length" class="highlight-note search-highlight-note">Blue marks show the word groups currently being checked in the bibliography.</p>
        <p v-else-if="selectedAppearance?.page === previewPage && !isRenderingPage" class="highlight-note">The name was identified on this page, but its position could not be matched for highlighting.</p>
        <details class="text-details"><summary>Review extracted document text ({{ documentText.length.toLocaleString() }} characters)</summary><pre class="document-text">{{ documentText || 'No text found yet. Try OCR on pages without selectable text.' }}</pre></details>
      </section>

      <div class="task-panel-stack">
      <section v-if="selectedMetadataSource && activeStep === 'metadata'" class="panel selected-source-panel">
        <div class="panel-heading"><div><h2>Selected database reference</h2><p>This source is pinned; bibliography matching is paused.</p></div><button class="text-button" type="button" @click="clearSelectedMetadataSource">Change source</button></div>
        <p class="selected-source-citation"><cite>{{ selectedMetadataSource.citation || selectedMetadataSource.metadata }}</cite></p>
      </section>

      <section v-if="activeStep === 'metadata'" class="panel metadata-panel">
        <div class="panel-heading"><div><h2>Step 1: Source metadata</h2><p>The search checks pages in order, using extracted text and OCR where needed, then ranks possible matches by fuzzy title similarity.</p></div><div class="metadata-actions"><button class="secondary-button" type="button" :disabled="isFindingMetadataMatches || isOcrRunning || !pages.length" @click="matchMetadataFromPage(1, true)">{{ isFindingMetadataMatches ? 'Searching...' : 'Search all pages' }}</button><button class="text-button" type="button" @click="clearMetadata">Clear fields</button></div></div>
        <div v-if="isFindingMetadataMatches || hasCompletedMetadataSearch || metadataMatches.length || metadataMatchMessage" class="metadata-matches">
          <div class="metadata-match-heading"><strong>{{ isFindingMetadataMatches ? 'Checking the project bibliography…' : metadataMatches.length ? 'Possible matching publications in the project bibliography' : 'Project bibliography' }}</strong></div>
          <p v-if="isFindingMetadataMatches" role="status">Searching page {{ metadataMatchPage }} of {{ pages.length }} from top to bottom for title matches...</p>
          <p v-else-if="metadataMatchMessage" role="status">{{ metadataMatchMessage }}</p>
          <p v-else-if="hasCompletedMetadataSearch && !metadataMatches.length" role="status">No likely matches found in the project bibliography.</p>
          <ol v-if="metadataMatches.length"><li v-for="match in metadataMatches" :key="match.key"><div class="metadata-match-result"><div><RouterLink :to="{ path: '/resources/tw/filter/bibliography', query: { query_term: match.searchTerm } }">{{ match.title }}</RouterLink><small>{{ match.metadata }}</small><div v-if="expandedMetadataMatchKey === match.key" class="metadata-match-evidence"><span>Matched phrase from page {{ match.searchPage || metadataMatchPage }}:</span><q>{{ match.pageQuery || 'No query text available.' }}</q></div></div><div class="metadata-match-actions"><button class="secondary-button metadata-match-use-button" type="button" :aria-expanded="expandedMetadataMatchKey === match.key" @click="showMatchedText(match)">{{ expandedMetadataMatchKey === match.key ? 'Hide matched text' : 'Show matched text' }}</button><button class="secondary-button metadata-match-use-button" type="button" @click="useMetadataMatch(match)">Use this source</button></div></div></li></ol>
        </div>
        <div class="metadata-fields">
          <label class="metadata-field title-field"><span>Title</span><input v-model.trim="metadata.title" type="text" placeholder="Publication title"></label>
          <label class="metadata-field wide"><span>Author(s)</span><input v-model.trim="metadata.authors" type="text" placeholder="Authors as printed"></label>
          <label class="metadata-field year-field"><span>Year</span><input v-model.trim="metadata.year" inputmode="numeric" type="text" placeholder="Year"></label>
          <label class="metadata-field journal-field"><span>Journal or book</span><input v-model.trim="metadata.journal" type="text" placeholder="Journal, book, or series"></label>
          <label class="metadata-field"><span>Volume</span><input v-model.trim="metadata.volume" type="text" placeholder="Volume"></label>
          <label class="metadata-field"><span>Pages</span><input v-model.trim="metadata.pages" type="text" placeholder="Pages"></label>
          <label class="metadata-field wide"><span>DOI</span><div class="metadata-input-row"><input v-model.trim="metadata.doi" type="text" placeholder="10.xxxx/example"><button class="secondary-button" type="button" :disabled="isLookingUpDoi || !parseDoi(metadata.doi)" @click="lookupDoiMetadata()">{{ isLookingUpDoi ? 'Looking up…' : 'Look up DOI' }}</button></div></label>
        </div>
        <p v-if="metadataSuggestionStatus" class="edit-status" role="status">{{ metadataSuggestionStatus }}</p>
        <div class="metadata-footer"><span>Fields can be edited at any time. No source record is created or changed by this step.</span><button class="primary-button" type="button" @click="activeStep = 'names'">Continue to GNFinder</button></div>
      </section>

      <section v-if="activeStep === 'names'" class="panel appearances-panel">
        <div class="panel-heading"><div><h2>Step 2: Publication name index</h2><p>Group flea-name appearances by name, verify the TaxonWorks match, and review the page index. Mark the publication's first page and enter its page range in metadata to show printed page numbers.</p></div><div class="panel-tools"><button class="text-button" type="button" @click="activeStep = 'metadata'">Back to metadata</button><span class="count-badge">{{ appearances.length }}</span><button v-if="appearances.length" class="secondary-button" type="button" @click="downloadIndexCsv">Download index CSV</button></div></div>
        <div class="privacy-note">
          <strong>Identify publication names:</strong> To use GNFinder, the extracted document text will be sent to its public service. The PDF itself is not sent. Avoid this step if the text is confidential or you do not have permission to share it.
          <label class="consent-row"><input v-model="gnfinderConsent" type="checkbox"> I agree to send the extracted text to GNFinder for taxon-name identification.</label>
          <div class="action-row"><button class="primary-button" type="button" :disabled="!gnfinderConsent || !documentText.trim() || isFindingNames" @click="identifyNames">{{ isFindingNames ? 'Checking names…' : appearances.length ? 'Identify names again' : 'Identify names with GNFinder' }}</button></div>
        </div>
        <p v-if="isFindingNames" class="muted-copy">Sending extracted text to GNFinder…</p>
        <p v-else-if="gnfinderError" class="notice error-notice">{{ gnfinderError }}</p>
        <div v-else-if="!appearances.length" class="empty-index-state"><p class="muted-copy">Agree to the data transfer above, then identify names. Add rows manually for names GNFinder misses.</p><button class="insert-index-button" type="button" aria-label="Add first name row" title="Add name row" @click="addIndexRow(0)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button></div>
        <div v-else class="appearance-table-wrap">
          <table class="appearance-table">
            <thead><tr><th>Page(s)</th><th>TaxonWorks match</th></tr></thead>
            <tbody>
              <template v-for="group in appearances" :key="group.id">
                <tr :class="{ 'selected-row': selectedIndexGroupId === group.id }" @click="selectFirstOccurrence(group)">
                  <td class="page-index-cell"><input v-if="group.occurrences.length === 1" :value="manualPublicationPageInput(group.occurrences[0])" type="number" min="1" aria-label="Publication page number" @change="updateOccurrencePublicationPage(group, group.occurrences[0], $event.target.value)"><span v-else>{{ pageIndexLabel(group) }}</span></td>
                  <td class="taxon-cell" @click.stop>
                    <div class="index-taxon-row">
                      <div class="index-taxon-control">
                    <div v-if="group.taxonMatch" class="selected-taxon"><span>{{ group.taxonMatch.label }}<small v-if="group.taxonMatch.type"> · {{ group.taxonMatch.type }}</small></span><button type="button" aria-label="Clear selected TaxonWorks match" @click="clearTaxonMatch(group)">×</button></div>
                        <div v-else class="taxon-search">
                          <input :value="group.taxonQuery" type="search" placeholder="Search TaxonWorks taxon names" @focus="searchTaxa(group, $event.target.value)" @input="searchTaxa(group, $event.target.value)">
                          <span v-if="group.taxonLoading" class="lookup-status">Searching...</span>
                          <div v-if="group.taxonSuggestions?.length" class="taxon-options"><button v-for="taxon in group.taxonSuggestions" :key="taxon.id" type="button" @click="chooseTaxon(group, taxon)">{{ taxon.label }}<small v-if="taxon.type"> · {{ taxon.type }}</small></button></div>
                          <span v-else-if="group.taxonQuery?.length >= 2 && !group.taxonLoading" class="lookup-status">No matching taxa</span>
                        </div>
                      </div>
                      <label class="new-taxon-toggle" @click.stop><input v-model="group.isNewSpecies" type="checkbox" @click.stop><span>New taxon</span></label>
                      <button class="icon-button trash-button" type="button" :aria-label="`Remove ${group.taxonMatch?.label || 'unmatched'} name row`" title="Remove name row" @click="removeIndexRow(group)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 3v7m4-7v7" /></svg></button>
                    </div>
                    <button v-if="group.occurrences.length > 1" class="expand-appearances" type="button" :aria-expanded="group.showOccurrences" @click="group.showOccurrences = !group.showOccurrences"><svg :class="{ 'is-expanded': group.showOccurrences }" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg><span>{{ group.showOccurrences ? 'Hide appearances' : `Show all ${group.occurrences.length} appearances` }}</span></button>
                  </td>
                </tr>
                <template v-if="group.showOccurrences">
                  <template v-for="(occurrence, index) in group.occurrences" :key="occurrence.id">
                    <tr class="subsequent-row" :class="{ 'current-occurrence-row': selectedAppearanceId === occurrence.id }" @click="selectAppearance(occurrence)"><td class="page-index-cell" @click.stop><input :value="manualPublicationPageInput(occurrence)" type="number" min="1" :aria-label="`Publication page for appearance ${index + 1}`" @change="updateOccurrencePublicationPage(group, occurrence, $event.target.value)"></td><td class="gn-name-cell"><div class="subsequent-name"><span aria-hidden="true">↳</span><span>{{ group.gnName || group.taxonMatch?.label || 'Unnamed flea name' }}</span><small>Appearance {{ index + 1 }}</small><button class="icon-button trash-button" type="button" :aria-label="`Remove appearance ${index + 1} for ${group.gnName || group.taxonMatch?.label || 'unnamed name'}`" title="Remove this appearance" @click.stop="removeIndexAppearance(group, occurrence)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 3v7m4-7v7" /></svg></button></div></td></tr>
                    <tr v-if="index < group.occurrences.length - 1" class="appearance-insert-row"><td colspan="2" class="insert-overlay-cell"><button class="insert-index-button" type="button" :aria-label="`Add appearance after appearance ${index + 1} of ${group.taxonMatch?.label || group.gnName || 'this name'}`" title="Add appearance here" @click="addIndexAppearance(group, index + 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button></td></tr>
                  </template>
                </template>
                <tr class="insert-index-row"><td colspan="2" class="insert-overlay-cell"><button class="insert-index-button" type="button" :aria-label="`Add name row after ${group.taxonMatch?.label || group.gnName || 'unnamed row'}`" title="Add name row here" @click="addIndexRow(appearances.indexOf(group) + 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button></td></tr>
              </template>
            </tbody>
          </table>
        </div>
        <div class="metadata-footer"><span>TaxonWorks matches and appearance pages can be edited at any time.</span><button class="primary-button" type="button" @click="activeStep = 'types'">Continue to specimen data</button></div>
      </section>

      <section v-if="activeStep === 'types'" class="panel type-data-panel">
        <div class="panel-heading">
          <div><h2>Step 3: Specimen data</h2><p>Enter one row per specimen record. Name-index entries marked as new taxa prefill specimen rows and flag them for type review.</p></div>
          <div class="panel-tools type-data-tools">
            <button class="text-button" type="button" @click="activeStep = 'names'">Back to name index</button>
            <select v-model="selectedTypeIndexGroupId" aria-label="Choose a name from the publication index">
              <option value="">Add a name from the index...</option>
              <option v-for="group in appearances" :key="group.id" :value="group.id">{{ group.gnName || group.taxonMatch?.label || 'Unnamed publication name' }}{{ group.taxonMatch && group.gnName ? ` — ${group.taxonMatch.label}` : '' }}{{ group.isNewSpecies ? ' — new taxon' : '' }}</option>
            </select>
            <button class="secondary-button" type="button" :disabled="!selectedTypeIndexGroupId" @click="addTypeRecordFromIndex">Add from index</button>
            <button class="secondary-button" type="button" @click="addTypeRecord()">Add specimen</button>
            <button class="primary-button" type="button" :disabled="!exportableTypeRecords.length || exportableTypeRecords.length !== typeDataRecords.length" @click="downloadTypeDataCsv">Download TaxonWorks DwC CSV</button>
          </div>
        </div>
        <p class="dwc-import-note">Each export row includes a unique occurrence ID, scientific name, and PreservedSpecimen basis of record. Type status is included for records marked as types.</p>
        <p v-if="!typeDataRecords.length" class="muted-copy">Add a specimen, or select a name from the index to prefill a specimen record.</p>
        <div v-else class="type-record-list">
          <div class="specimen-summary-header"><span>Species</span><span>Host</span><span>Location</span><span>Date</span></div>
          <article v-for="(record, index) in typeDataRecords" :key="record.id" class="type-record-card">
            <button class="specimen-summary" type="button" :aria-expanded="record.detailsOpen" @click="record.detailsOpen = !record.detailsOpen">
              <span><strong>{{ record.taxonMatch?.label || record.nameInPublication || 'Unmatched species' }}</strong><small v-if="record.isNewSpecies" class="new-species-badge">New taxon</small><small v-else-if="record.isType" class="new-species-badge">Type</small></span>
              <span>{{ record.hostMatch?.label || record.host || '—' }}</span>
              <span>{{ specimenLocationSummary(record) }}</span>
              <span>{{ record.eventDate || record.verbatimEventDate || '—' }}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true" :class="{ 'is-expanded': record.detailsOpen }"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div v-if="record.detailsOpen" class="type-record-fields">
              <label class="type-record-field specimen-type-toggle"><span>Type specimen</span><span class="checkbox-control"><input v-model="record.isType" type="checkbox"><span>Type</span></span></label>
              <label v-if="record.isType" class="type-record-field"><span>Type status</span><select v-model="record.typeStatus"><option value="">Choose type status</option><option v-for="status in typeStatusOptions" :key="status" :value="status">{{ status }}</option></select></label>
              <label class="type-record-field"><span>Article page</span><input :value="manualSpecimenPublicationPageInput(record)" type="number" min="1" inputmode="numeric" @change="updateSpecimenPublicationPage(record, $event.target.value)"></label>
              <label class="type-record-field"><span>Species as published</span><input v-model.trim="record.nameInPublication" type="text" placeholder="Name used in this paper"></label>
              <div class="type-record-field"><span>TaxonWorks species</span>
                <div v-if="record.taxonMatch" class="selected-taxon"><span>{{ record.taxonMatch.label }}<small v-if="record.taxonMatch.type"> · {{ record.taxonMatch.type }}</small></span><button type="button" aria-label="Clear selected TaxonWorks taxon" @click="clearTaxonMatch(record)">×</button></div>
                <div v-else class="taxon-search"><input :value="record.taxonQuery" type="search" placeholder="Search TaxonWorks taxon names" @focus="searchTaxa(record, $event.target.value)" @input="searchTaxa(record, $event.target.value)"><span v-if="record.taxonLoading" class="lookup-status">Searching...</span><div v-if="record.taxonSuggestions?.length" class="taxon-options"><button v-for="taxon in record.taxonSuggestions" :key="taxon.id" type="button" @click="chooseTaxon(record, taxon)">{{ taxon.label }}<small v-if="taxon.type"> · {{ taxon.type }}</small></button></div></div>
              </div>
              <div class="type-record-field"><span>Host</span>
                <div v-if="record.hostMatch" class="selected-taxon"><span>{{ record.hostMatch.label }}<small v-if="record.hostMatch.type"> · {{ record.hostMatch.type }}</small></span><button type="button" aria-label="Clear host taxon" @click="clearSpecimenMatch(record, 'host')">×</button></div>
                <div v-else class="specimen-autocomplete"><input v-model.trim="record.hostQuery" type="search" placeholder="Search TaxonWorks taxon names" @focus="searchSpecimenOptions(record, 'host', record.hostQuery)" @input="searchSpecimenOptions(record, 'host', record.hostQuery)"><span v-if="record.hostLoading" class="lookup-status">Searching...</span><div v-if="record.hostSuggestions.length" class="taxon-options"><button v-for="taxon in record.hostSuggestions" :key="taxon.id" type="button" @click="selectSpecimenMatch(record, 'host', taxon)">{{ taxon.label }}<small v-if="taxon.type"> · {{ taxon.type }}</small></button></div></div>
                <input v-if="!record.hostMatch" v-model.trim="record.host" type="text" placeholder="Or enter host as published">
              </div>
              <div class="type-record-field"><span>Institution / repository</span>
                <div v-if="record.repositoryMatch"><div class="selected-taxon"><span>{{ record.repositoryMatch.label }}</span><button type="button" aria-label="Clear selected repository" @click="clearSpecimenMatch(record, 'repository')">×</button></div><input v-model.trim="record.institutionCode" type="text" placeholder="Institution code for export"></div>
                <div v-else><div class="specimen-autocomplete"><input v-model.trim="record.repositoryQuery" type="search" placeholder="Search TaxonWorks repositories" @focus="searchSpecimenOptions(record, 'repository', record.repositoryQuery)" @input="searchSpecimenOptions(record, 'repository', record.repositoryQuery)"><span v-if="record.repositoryLoading" class="lookup-status">Searching...</span><div v-if="record.repositorySuggestions.length" class="taxon-options"><button v-for="repository in record.repositorySuggestions" :key="repository.id" type="button" @click="selectSpecimenMatch(record, 'repository', repository)">{{ repository.label }}</button></div></div><input v-model.trim="record.institutionCode" type="text" placeholder="Or enter institution code"></div>
              </div>
              <label class="type-record-field"><span>Catalog number</span><input v-model.trim="record.catalogNumber" type="text" placeholder="Specimen identifier"></label>
              <div v-for="field in geographicFields" :key="field.key" class="type-record-field"><span>{{ field.label }}</span>
                <div v-if="record[`${field.key}Match`]?.label" class="selected-taxon"><span>{{ record[`${field.key}Match`].label }}</span><button type="button" :aria-label="`Clear ${field.label}`" @click="clearSpecimenMatch(record, field.key)">×</button></div>
                <div v-else class="specimen-autocomplete"><input v-model.trim="record[field.key]" type="search" :placeholder="`Search ${field.label.toLowerCase()} in TaxonWorks`" @focus="searchSpecimenOptions(record, field.key, record[field.key])" @input="searchSpecimenOptions(record, field.key, record[field.key])"><span v-if="record[`${field.key}Loading`]" class="lookup-status">Searching...</span><div v-if="record[`${field.key}Suggestions`].length" class="taxon-options"><button v-for="area in record[`${field.key}Suggestions`]" :key="area.id" type="button" @click="selectSpecimenMatch(record, field.key, area)">{{ area.label }}</button></div></div>
              </div>
              <label class="type-record-field type-record-wide"><span>Verbatim locality</span><input v-model.trim="record.verbatimLocality" type="text" placeholder="Locality as written in the publication"></label>
              <label class="type-record-field type-record-wide"><span>Verbatim date</span><input v-model.trim="record.verbatimEventDate" type="text" placeholder="Date as written" @change="normalizeSpecimenDate(record)"></label>
              <label class="type-record-field"><span>Darwin Core eventDate</span><input v-model.trim="record.eventDate" type="text" placeholder="YYYY-MM-DD or YYYY-MM-DD/YYYY-MM-DD"></label>
              <div class="type-record-field"><span>Collectors</span>
                <div v-if="record.collectors.length" class="collector-chips"><span v-for="collector in record.collectors" :key="collector.id || collector.label" class="collector-chip">{{ collector.label }}<button type="button" :aria-label="`Remove collector ${collector.label}`" @click="removeSpecimenCollector(record, collector)">×</button></span></div>
                <div class="specimen-autocomplete"><input v-model.trim="record.collectorQuery" type="search" placeholder="Search TaxonWorks people" @focus="searchSpecimenOptions(record, 'collector', record.collectorQuery)" @input="searchSpecimenOptions(record, 'collector', record.collectorQuery)"><span v-if="record.collectorLoading" class="lookup-status">Searching...</span><div v-if="record.collectorSuggestions.length" class="taxon-options"><button v-for="collector in record.collectorSuggestions" :key="collector.id" type="button" @click="selectSpecimenMatch(record, 'collector', collector)">{{ collector.label }}</button></div></div>
                <input v-model.trim="record.recordedByOther" type="text" placeholder="Other collector names as written">
              </div>
              <label class="type-record-field"><span>Sex</span><input v-model.trim="record.sex" type="search" :list="`sex-options-${record.id}`" placeholder="Search sex values"><datalist :id="`sex-options-${record.id}`"><option v-for="sex in sexOptions" :key="sex" :value="sex" /></datalist></label>
              <label class="type-record-field"><span>Life stage</span><input v-model.trim="record.lifeStage" type="text" placeholder="Adult, larva..."></label>
              <div class="type-record-field"><span>Individual count</span><select v-model="record.individualCountMode"><option value="aggregate">Aggregate count</option><option value="sexCounts">Separate M/F counts</option></select><input v-if="record.individualCountMode === 'aggregate'" v-model.trim="record.individualCount" type="number" min="1" placeholder="Total count"><div v-else class="count-pair"><label><span>M</span><input v-model.trim="record.maleCount" type="number" min="0" placeholder="0"></label><label><span>F</span><input v-model.trim="record.femaleCount" type="number" min="0" placeholder="0"></label></div></div>
              <label class="type-record-field"><span>Decimal latitude</span><input v-model.trim="record.decimalLatitude" type="number" step="any" placeholder="Latitude"></label>
              <label class="type-record-field"><span>Decimal longitude</span><input v-model.trim="record.decimalLongitude" type="number" step="any" placeholder="Longitude"></label>
              <label class="type-record-field"><span>Elevation (verbatim)</span><input v-model.trim="record.verbatimElevation" type="text" placeholder="Elevation as written"></label>
              <label class="type-record-field type-record-wide"><span>Occurrence remarks</span><input v-model.trim="record.occurrenceRemarks" type="text" placeholder="Additional specimen or type notes"></label>
              <label class="type-record-field"><span>Additional publication evidence</span><textarea v-model.trim="record.specimenEvidence" rows="3" placeholder="Relevant label or specimen text from the publication"></textarea></label>
            </div>
            <div v-if="record.detailsOpen" class="type-record-footer"><span>Article page {{ publicationPageLabel(record.page) || '—' }} · {{ record.isNewSpecies ? 'New taxon' : record.isType ? 'Type specimen' : 'Specimen record' }}</span><button class="remove-button" type="button" @click="removeTypeRecord(record)">Remove specimen</button></div>
          </article>
        </div>
        <p v-if="typeDataRecords.length && exportableTypeRecords.length !== typeDataRecords.length" class="edit-status" role="status">Complete the species name and any required type status on each row, or remove unfinished rows, to export all records.</p>
        <p v-if="typeDataExportMessage" class="edit-status" role="status">{{ typeDataExportMessage }}</p>
        <div class="metadata-footer"><span>Specimen records and references can be reviewed before exporting the publication package.</span><button class="primary-button" type="button" @click="activeStep = 'references'">Continue to references</button></div>
      </section>

      <section v-if="activeStep === 'references'" class="panel references-panel">
        <div class="panel-heading">
          <div><h2>Step 4: References</h2><p>Scan the publication’s reference list, match citations to articles in the project bibliography, and add publications that are missing.</p></div>
          <div class="panel-tools reference-tools">
            <button class="text-button" type="button" @click="activeStep = 'types'">Back to specimen data</button>
            <button class="secondary-button" type="button" :disabled="isScanningReferences || !pages.length" @click="scanReferencesFromOcr">{{ isScanningReferences ? 'Scanning OCR…' : 'Scan OCR for references' }}</button>
            <button class="secondary-button" type="button" @click="addReferenceRecord({ manuallyAdded: true })">Add missing publication</button>
            <button class="primary-button" type="button" :disabled="incompleteReferenceRecords.length > 0" @click="downloadReferencesBibtex">Download BibTeX</button>
          </div>
        </div>
        <p class="dwc-import-note">Each reference can be edited and searched against the project bibliography. Choosing a match fills empty citation fields; unmatched publications remain available for BibTeX export.</p>
        <p v-if="referenceScanMessage" class="edit-status" role="status">{{ referenceScanMessage }}</p>
        <p v-if="!referenceRecords.length" class="muted-copy">Scan OCR to find references in the publication, or add a missing publication manually.</p>
        <div v-else class="reference-record-list">
          <div class="reference-summary-header"><span>Title</span><span>Author(s)</span><span>Year</span><span>Database match</span></div>
          <article v-for="(reference, index) in referenceRecords" :key="reference.id" class="reference-record-card">
            <button class="reference-summary" type="button" :aria-expanded="reference.detailsOpen" @click="reference.detailsOpen = !reference.detailsOpen">
              <span><strong>{{ reference.title || reference.ocrCitation || 'Untitled reference' }}</strong><small v-if="reference.originalPage">OCR page {{ reference.originalPage }}</small></span>
              <span>{{ reference.authors || '—' }}</span>
              <span>{{ reference.year || '—' }}</span>
              <span>{{ reference.databaseMatch?.title || (reference.matches.length ? `${reference.matches.length} possible match(es)` : 'Not searched') }}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true" :class="{ 'is-expanded': reference.detailsOpen }"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div v-if="reference.detailsOpen" class="reference-fields-wrap">
              <div class="metadata-fields">
                <label class="metadata-field title-field"><span>Title</span><input v-model.trim="reference.title" type="text" placeholder="Publication title"></label>
                <label class="metadata-field wide"><span>Author(s)</span><input v-model.trim="reference.authors" type="text" placeholder="Authors as printed"></label>
                <label class="metadata-field year-field"><span>Year</span><input v-model.trim="reference.year" inputmode="numeric" type="text" placeholder="Year"></label>
                <label class="metadata-field journal-field"><span>Journal or book</span><input v-model.trim="reference.journal" type="text" placeholder="Journal, book, or series"></label>
                <label class="metadata-field"><span>Volume</span><input v-model.trim="reference.volume" type="text" placeholder="Volume"></label>
                <label class="metadata-field"><span>Pages</span><input v-model.trim="reference.pages" type="text" placeholder="Pages"></label>
                <label class="metadata-field wide"><span>DOI</span><div class="metadata-input-row"><input v-model.trim="reference.doi" type="text" placeholder="10.xxxx/example"><button class="secondary-button" type="button" :disabled="reference.isLookingUpDoi || !parseDoi(reference.doi)" @click="lookupReferenceDoi(reference)">{{ reference.isLookingUpDoi ? 'Looking up…' : 'Look up DOI' }}</button></div></label>
              </div>
              <div class="reference-match-tools"><span v-if="reference.databaseMatch" class="reference-match-status">Matched to project source: {{ reference.databaseMatch.title }}</span><button class="secondary-button" type="button" :disabled="reference.isSearching || !hasPublicationSearchCriteria(reference)" @click="searchReferenceMatches(reference)">{{ reference.isSearching ? 'Searching…' : 'Search project bibliography' }}</button><button class="text-button" type="button" @click="removeReferenceRecord(reference)">Remove reference</button></div>
              <p v-if="reference.matchMessage" class="edit-status" role="status">{{ reference.matchMessage }}</p>
              <ol v-if="reference.matches.length" class="reference-match-list"><li v-for="match in reference.matches" :key="match.key"><div><RouterLink :to="{ path: '/resources/tw/filter/bibliography', query: { query_term: match.searchTerm } }">{{ match.title }}</RouterLink><small>{{ match.metadata }}</small></div><button class="secondary-button" type="button" @click="useReferenceMatch(reference, match)">Use this article</button></li></ol>
              <details v-if="reference.ocrCitation" class="reference-ocr-text"><summary>OCR citation text</summary><p>{{ reference.ocrCitation }}</p></details>
              <div class="reference-record-footer"><span>{{ reference.manuallyAdded ? 'Manually added publication' : 'Detected in OCR' }}</span><button class="remove-button" type="button" @click="removeReferenceRecord(reference)">Remove</button></div>
            </div>
          </article>
        </div>
        <p v-if="incompleteReferenceRecords.length" class="edit-status" role="status">A title is required for each reference before downloading the BibTeX file directly. The ZIP package remains available and preserves partial citation details.</p>
        <div class="bundle-download-panel">
          <div><h3>Publication package</h3><p>Download the latest PDF, name index, specimen Darwin Core Archive, and references BibTeX together. Incomplete specimen rows are included as entered; references with citation details are included in BibTeX.</p></div>
          <label class="pdf-export-name"><span>PDF filename</span><input v-model.trim="pdfExportName" type="text" :placeholder="defaultPdfExportName"></label>
          <button class="primary-button" type="button" :disabled="!currentPdfBytes" @click="downloadPublicationBundle">Download ZIP package</button>
        </div>
        <p v-if="bundleExportMessage" class="edit-status" role="status">{{ bundleExportMessage }}</p>
      </section>
      </div>
    </section>
    <p class="disclaimer">GNFinder names and reference matches are suggestions for review. PDF, name index, specimen archive, and BibTeX files are assembled locally and are not uploaded to TaxonWorks.</p>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import { makeAPIRequest } from '@/utils/request'
import { lookupDoi, parseDoi } from './components/Inbox/doiLookup.js'
import { findProjectPublicationMatches, findProjectPublicationMatchesFromText, hasPublicationSearchCriteria } from './data/publicationMatches.js'
import { findNames, nameHighlightRects, ocrNameHighlightRects, ocrPages, readPdf } from './data/pdfProcessor.js'

const file = ref(null)
const pdf = shallowRef(null)
const pdfLoadingTask = shallowRef(null)
const pdfEditor = shallowRef(null)
const currentPdfBytes = shallowRef(null)
const activeStep = ref('metadata')
const metadata = reactive({ doi: '', authors: '', year: '', title: '', journal: '', volume: '', pages: '' })
const metadataMatches = ref([])
const typeDataRecords = ref([])
const referenceRecords = ref([])
const selectedTypeIndexGroupId = ref('')
const typeDataExportMessage = ref('')
const referenceScanMessage = ref('')
const bundleExportMessage = ref('')
const isScanningReferences = ref(false)
const pdfExportName = ref('')
const defaultPdfExportName = computed(() => `${String(metadata.title || file.value?.name?.replace(/\.pdf$/i, '') || 'publication').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'publication'}.pdf`)
const typeStatusOptions = ['Holotype', 'Paratype', 'Allotype', 'Lectotype', 'Paralectotype', 'Neotype', 'Syntype', 'Cotype', 'Topotype']
const sexOptions = ['male', 'female', 'male and female', 'unknown', 'undetermined']
const geographicFields = [
  { key: 'country', label: 'Country' },
  { key: 'stateProvince', label: 'State or province' },
  { key: 'county', label: 'County' }
]
const expandedMetadataMatchKey = ref(null)
const selectedMetadataSource = ref(null)
const metadataMatchMessage = ref('')
const metadataSuggestionStatus = ref('')
const hasCompletedMetadataSearch = ref(false)
const isLookingUpDoi = ref(false)
const isFindingMetadataMatches = ref(false)
const pages = ref([])
const metadataMatchPage = ref(1)
const pdfCanvas = ref(null)
const previewSurface = ref(null)
const highlightFocus = ref(null)
const previewPage = ref(1)
const previewZoom = ref(1)
const firstPageNumber = ref(null)
const selectedAppearanceId = ref(null)
const highlightRects = ref([])
const searchHighlightRects = ref([])
const metadataSearchPhrases = ref([])
const highlightBounds = ref(null)
const isRenderingPage = ref(false)
const error = ref('')
const gnfinderError = ref('')
const pdfEditError = ref('')
const isDragging = ref(false)
const appearances = ref([])
const isOcrRunning = ref(false)
const isFindingNames = ref(false)
const isEditingPdf = ref(false)
const ocrPercent = ref(0)
const gnfinderConsent = ref(false)
const selectedAppearance = computed(() => {
  for (const group of appearances.value) {
    const occurrence = group.occurrences?.find((item) => item.id === selectedAppearanceId.value)
    if (occurrence) return occurrence.gnName ? occurrence : { ...occurrence, gnName: group.gnName }
  }
  return null
})
const selectedIndexGroupId = computed(() => appearances.value.find((group) => group.occurrences?.some((appearance) => appearance.id === selectedAppearanceId.value))?.id || null)
const missingTextPages = computed(() => pages.value.filter((page) => !page.hasText))
const metadataOcrPageNumbers = computed(() => pages.value.filter((page) => !page.ocrText).map((page) => page.pageNumber))
const exportableTypeRecords = computed(() => typeDataRecords.value.filter((record) =>
  Boolean((record.taxonMatch?.label || record.nameInPublication?.trim() || record.taxonQuery?.trim()) && (!record.isType || record.typeStatus?.trim()))
))
const incompleteReferenceRecords = computed(() => referenceRecords.value.filter((record) => !record.title?.trim()))
const documentText = computed(() => pages.value.map((page) => `--- Page ${page.pageNumber} ---\n${page.text}`.trim()).join('\n\n'))
let renderSequence = 0
let previewRenderTask = null
let previewResizeObserver = null
let lastPreviewWheelAt = 0
const searchTimers = new Map()
const specimenSearchTimers = new Map()
let metadataSearchId = 0
let referenceScanId = 0
let metadataSearchTimer
let skipMetadataFieldSearch = false
let pdfLibModule

function formatBytes(bytes) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function metadataTextForPage(page) {
  const extractedText = String(page?.text || '')
  return extractedText.trim().length >= 40 ? extractedText : String(page?.ocrText || extractedText)
}

function doiFromText(text) {
  const match = String(text || '').match(/10\.\d{4,9}\/[^\s<>"']+/i)
  return match ? parseDoi(match[0]) : ''
}

function setMetadataDoiWithoutSearch(doi) {
  skipMetadataFieldSearch = true
  try {
    metadata.doi = doi
  } finally {
    skipMetadataFieldSearch = false
  }
}

async function matchMetadataFromPage(_pageNumber = 1, overwrite = false) {
  if (!file.value || !pages.value.length) return
  const requestId = ++metadataSearchId
  clearTimeout(metadataSearchTimer)
  const searchPages = [...pages.value]
  expandedMetadataMatchKey.value = null
  metadataMatchPage.value = searchPages[0]?.pageNumber || 1
  metadataSearchPhrases.value = []
  searchHighlightRects.value = []
  goToPreviewPage(metadataMatchPage.value)
  isFindingMetadataMatches.value = true
  if (overwrite) selectedMetadataSource.value = null
  metadataSuggestionStatus.value = 'Searching pages from the beginning of the document for close title matches.'
  metadataMatches.value = []
  metadataMatchMessage.value = ''
  hasCompletedMetadataSearch.value = false
  try {
    const documentDoi = doiFromText(searchPages.map(metadataTextForPage).join('\n'))
    let doiToCheck = parseDoi(metadata.doi) || documentDoi
    if (doiToCheck) {
      if (!parseDoi(metadata.doi)) setMetadataDoiWithoutSearch(doiToCheck)
      metadataSuggestionStatus.value = documentDoi
        ? 'DOI found in the document. Looking up publication metadata before the bibliography search.'
        : 'Looking up the DOI before the bibliography search.'
      await lookupDoiMetadata(requestId)
      if (requestId !== metadataSearchId || !file.value) return
    }
    const rankedMatches = new Map()
    let searchMessage = ''
    let searchedReadablePage = false
    let activePage = metadataMatchPage.value
    for (const page of searchPages) {
      if (requestId !== metadataSearchId || !file.value) return
      activePage = page.pageNumber
      metadataMatchPage.value = activePage
      goToPreviewPage(activePage)
      metadataSearchPhrases.value = []
      let currentPage = pages.value.find((entry) => entry.pageNumber === activePage)
      let pageText = metadataTextForPage(currentPage)
      if (pageText.trim().length < 40 && !currentPage?.ocrText) {
        await runOcr([activePage])
        if (requestId !== metadataSearchId || !file.value) return
        currentPage = pages.value.find((entry) => entry.pageNumber === activePage)
        pageText = metadataTextForPage(currentPage)
      }
      if (!doiToCheck && (doiToCheck = doiFromText(pageText))) {
        setMetadataDoiWithoutSearch(doiToCheck)
        metadataSuggestionStatus.value = `DOI found on page ${activePage}. Looking up publication metadata before continuing the bibliography search.`
        await lookupDoiMetadata(requestId)
        if (requestId !== metadataSearchId || !file.value) return
      }
      if (pageText.trim().length < 40) continue
      searchedReadablePage = true
      const result = await findProjectPublicationMatchesFromText(pageText, {
        onQueries: (queries) => {
          if (requestId !== metadataSearchId) return
          metadataMatchPage.value = activePage
          metadataSearchPhrases.value = queries
        }
      })
      if (requestId !== metadataSearchId || !file.value) return
      if (result.message && !searchMessage) searchMessage = result.message
      for (const match of result.matches) {
        const pageMatch = { ...match, searchPage: activePage }
        const previous = rankedMatches.get(pageMatch.key)
        if (!previous || pageMatch.score > previous.score) rankedMatches.set(pageMatch.key, pageMatch)
      }
      if (result.highlightQueries?.length) metadataSearchPhrases.value = result.highlightQueries
      if (result.closeMatch) break
    }
    const matches = [...rankedMatches.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 8)
    const finalPage = matches[0]?.searchPage || activePage
    if (matches.length) {
      metadataMatchPage.value = finalPage
      goToPreviewPage(finalPage)
      const pageQueries = [...new Set(matches.filter((match) => match.searchPage === finalPage).map((match) => match.pageQuery).filter(Boolean))].slice(0, 3)
      if (pageQueries.length) metadataSearchPhrases.value = pageQueries
    }
    selectedMetadataSource.value = null
    metadataMatches.value = matches
    metadataMatchMessage.value = matches.length
      ? 'Review the title matches below. Choose "Use this source" to fill the citation fields.'
      : searchMessage || (searchedReadablePage
        ? 'No likely title matches were found in the document. Enter the citation details manually or review the PDF text.'
        : 'The document has too little readable text to search. Try OCR or review the PDF text manually.')
    hasCompletedMetadataSearch.value = true
    metadataSuggestionStatus.value = matches.length
      ? `Found ${matches.length} possible title match(es) in the document. The citation fields have not been changed.`
      : 'The citation fields have not been changed by this search.'
  } catch {
    if (requestId !== metadataSearchId) return
    selectedMetadataSource.value = null
    metadataMatches.value = []
    metadataMatchMessage.value = 'The bibliography could not be checked against the document. The citation fields were not changed.'
    hasCompletedMetadataSearch.value = true
  } finally {
    if (requestId === metadataSearchId) isFindingMetadataMatches.value = false
  }
}

function clearMetadata() {
  metadataSearchId += 1
  clearTimeout(metadataSearchTimer)
  expandedMetadataMatchKey.value = null
  metadataSearchPhrases.value = []
  searchHighlightRects.value = []
  Object.keys(metadata).forEach((key) => { metadata[key] = '' })
  metadataSuggestionStatus.value = ''
  metadataMatches.value = []
  selectedMetadataSource.value = null
  metadataMatchMessage.value = ''
  hasCompletedMetadataSearch.value = false
  isFindingMetadataMatches.value = false
}

async function lookupDoiMetadata(expectedSearchId = null) {
  const doi = parseDoi(metadata.doi)
  if (!doi || isLookingUpDoi.value) return
  isLookingUpDoi.value = true
  metadataMatchMessage.value = ''
  try {
    const details = await lookupDoi(doi)
    if (expectedSearchId !== null && expectedSearchId !== metadataSearchId) return
    skipMetadataFieldSearch = true
    try {
      if (!metadata.doi) metadata.doi = details.doi
      for (const key of ['title', 'authors', 'year', 'journal', 'volume', 'pages']) {
        if (!metadata[key] && details[key]) metadata[key] = details[key]
      }
    } finally {
      skipMetadataFieldSearch = false
    }
    metadataSuggestionStatus.value = 'DOI metadata found. Empty fields were filled; please review them.'
  } catch (cause) {
    if (expectedSearchId !== null && expectedSearchId !== metadataSearchId) return
    metadataSuggestionStatus.value = cause?.message || 'DOI lookup failed. You can enter the citation details manually.'
  } finally {
    isLookingUpDoi.value = false
  }
}

async function searchMetadataMatches() {
  if (!hasPublicationSearchCriteria(metadata)) return
  const requestId = ++metadataSearchId
  isFindingMetadataMatches.value = true
  metadataMatches.value = []
  metadataMatchMessage.value = ''
  try {
    const result = await findProjectPublicationMatches(metadata, { tolerateOcrErrors: true })
    if (requestId !== metadataSearchId) return
    metadataMatches.value = result.matches
    metadataMatchMessage.value = result.message
  } catch {
    if (requestId !== metadataSearchId) return
    metadataMatchMessage.value = 'The project bibliography could not be reached. Please try again.'
  } finally {
    if (requestId === metadataSearchId) {
      isFindingMetadataMatches.value = false
      hasCompletedMetadataSearch.value = true
    }
  }
}

function showMatchedText(match) {
  if (expandedMetadataMatchKey.value === match.key) {
    expandedMetadataMatchKey.value = null
    return
  }
  expandedMetadataMatchKey.value = match.key
  const pageNumber = Number(match.searchPage || metadataMatchPage.value)
  metadataMatchPage.value = pageNumber
  metadataSearchPhrases.value = match.pageQuery ? [match.pageQuery] : []
  goToPreviewPage(pageNumber)
}

function useMetadataMatch(match) {
  selectedMetadataSource.value = match
  metadataSearchId += 1
  clearTimeout(metadataSearchTimer)
  metadataMatches.value = []
  metadataMatchMessage.value = ''
  isFindingMetadataMatches.value = false
  hasCompletedMetadataSearch.value = false
  expandedMetadataMatchKey.value = null
  const fields = match?.fields || {}
  const updated = []
  for (const key of ['doi', 'title', 'authors', 'year', 'journal', 'volume', 'pages']) {
    if (fields[key]) {
      metadata[key] = String(fields[key])
      updated.push(key)
    }
  }
  metadataSuggestionStatus.value = updated.length
    ? `Filled ${updated.join(', ')} from the selected project source. Review the details before continuing.`
    : 'This project source does not have additional citation metadata to fill.'
}

function clearSelectedMetadataSource() {
  selectedMetadataSource.value = null
  metadataSuggestionStatus.value = 'Source selection cleared. Checking for other bibliography matches.'
  if (hasPublicationSearchCriteria(metadata)) void searchMetadataMatches()
}

async function selectFile(event) {
  const nextFile = event.target.files?.[0]
  if (!nextFile) return
  await loadFile(nextFile)
  event.target.value = ''
}

function handleDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) isDragging.value = false
}

function handleDrop(event) {
  isDragging.value = false
  const droppedFile = event.dataTransfer?.files?.[0]
  if (droppedFile) void loadFile(droppedFile)
}

async function loadFile(nextFile) {
  if (!/\.pdf$/i.test(nextFile.name) && nextFile.type !== 'application/pdf') {
    error.value = 'Please choose a PDF file.'
    return
  }
  clearDocument()
  file.value = nextFile
  error.value = ''
  try {
    const bytes = new Uint8Array(await nextFile.arrayBuffer())
    pdfLibModule ||= await import('pdf-lib')
    const editor = await pdfLibModule.PDFDocument.load(bytes.slice())
    const result = await readPdf(bytes.slice())
    pdfEditor.value = editor
    currentPdfBytes.value = bytes
    pdf.value = result.pdf
    pdfLoadingTask.value = result.loadingTask
    pages.value = result.pages
    previewPage.value = 1
    previewZoom.value = 1
    firstPageNumber.value = null
    metadataMatchPage.value = 1
  } catch (cause) {
    error.value = cause?.message || 'The PDF could not be opened. Try another file.'
    file.value = null
  }
}

function clearDocument() {
  renderSequence += 1
  previewRenderTask?.cancel()
  metadataSearchId += 1
  skipMetadataFieldSearch = false
  clearTimeout(metadataSearchTimer)
  disposePdfLoadingTask(pdfLoadingTask.value)
  file.value = null
  pdf.value = null
  pdfLoadingTask.value = null
  pdfEditor.value = null
  currentPdfBytes.value = null
  pages.value = []
  typeDataRecords.value.forEach((record) => {
    clearTimeout(searchTimers.get(record.id))
    searchTimers.delete(record.id)
    clearSpecimenRecordTimers(record)
  })
  typeDataRecords.value = []
  referenceScanId += 1
  referenceRecords.value = []
  referenceScanMessage.value = ''
  bundleExportMessage.value = ''
  isScanningReferences.value = false
  pdfExportName.value = ''
  selectedTypeIndexGroupId.value = ''
  typeDataExportMessage.value = ''
  metadataMatchPage.value = 1
  previewPage.value = 1
  previewZoom.value = 1
  firstPageNumber.value = null
  selectedAppearanceId.value = null
  highlightRects.value = []
  searchHighlightRects.value = []
  metadataSearchPhrases.value = []
  highlightBounds.value = null
  error.value = ''
  gnfinderError.value = ''
  pdfEditError.value = ''
  appearances.value = []
  gnfinderConsent.value = false
  activeStep.value = 'metadata'
  Object.keys(metadata).forEach((key) => { metadata[key] = '' })
  metadataMatches.value = []
  selectedMetadataSource.value = null
  metadataMatchMessage.value = ''
  hasCompletedMetadataSearch.value = false
  metadataSuggestionStatus.value = ''
  isFindingMetadataMatches.value = false
}

function disposePdfLoadingTask(task) {
  if (task) void task.destroy().catch(() => {})
}

async function refreshEditedPdf({ removedPageNumber = null, rotatedPageNumber = null } = {}) {
  if (!pdfEditor.value) return
  isEditingPdf.value = true
  pdfEditError.value = ''
  const previousPages = pages.value
  try {
    const bytes = new Uint8Array(await pdfEditor.value.save())
    const result = await readPdf(bytes.slice())
    const nextPages = result.pages.map((page) => {
      const previousPageNumber = removedPageNumber && page.pageNumber >= removedPageNumber
        ? page.pageNumber + 1
        : page.pageNumber
      const previous = previousPages.find((entry) => entry.pageNumber === previousPageNumber)
      if (!page.hasText && previous?.hasText) {
        const wasRotated = previousPageNumber === rotatedPageNumber
        return {
          ...page,
          text: previous.text,
          hasText: wasRotated && previous.ocrWords ? false : previous.hasText,
          ...(wasRotated ? {} : { ocrWords: previous.ocrWords, width: previous.width, height: previous.height })
        }
      }
      return page
    })

    disposePdfLoadingTask(pdfLoadingTask.value)
    currentPdfBytes.value = bytes
    pdf.value = result.pdf
    pdfLoadingTask.value = result.loadingTask
    pages.value = nextPages

    if (removedPageNumber) {
      if (firstPageNumber.value != null) {
        if (firstPageNumber.value > removedPageNumber) firstPageNumber.value -= 1
        else if (firstPageNumber.value === removedPageNumber) {
          firstPageNumber.value = Math.min(removedPageNumber, result.pages.length) || null
        }
      }
      const wasSelectedPage = selectedAppearance.value?.page === removedPageNumber
      appearances.value = appearances.value.flatMap((group) => {
        group.occurrences = group.occurrences
          .filter((occurrence) => occurrence.page !== removedPageNumber)
          .map((occurrence) => occurrence.page > removedPageNumber ? { ...occurrence, page: occurrence.page - 1 } : occurrence)
        refreshIndexPages(group)
        return group.occurrences.length ? [group] : []
      })
      if (wasSelectedPage) selectedAppearanceId.value = null
      previewPage.value = Math.min(removedPageNumber, result.pages.length)
      if (wasSelectedPage && appearances.value.length) selectFirstOccurrence(appearances.value[0])
      else if (selectedAppearance.value?.page) previewPage.value = selectedAppearance.value.page
    }
  } catch (cause) {
    pdfEditError.value = cause?.message || 'The PDF edit could not be applied.'
  } finally {
    isEditingPdf.value = false
  }
}

async function rotateCurrentPage(direction) {
  if (!pdfEditor.value || !previewPage.value) return
  try {
    const page = pdfEditor.value.getPage(previewPage.value - 1)
    const currentAngle = page.getRotation().angle || 0
    page.setRotation(pdfLibModule.degrees(((currentAngle + direction) % 360 + 360) % 360))
    await refreshEditedPdf({ rotatedPageNumber: previewPage.value })
  } catch (cause) {
    pdfEditError.value = cause?.message || 'This page could not be rotated.'
  }
}

async function removeCurrentPage() {
  if (!pdfEditor.value || pages.value.length <= 1) return
  const removedPageNumber = previewPage.value
  try {
    pdfEditor.value.removePage(removedPageNumber - 1)
    await refreshEditedPdf({ removedPageNumber })
  } catch (cause) {
    pdfEditError.value = cause?.message || 'This page could not be removed.'
  }
}

function downloadEditedPdf() {
  if (!currentPdfBytes.value) return
  const url = URL.createObjectURL(new Blob([currentPdfBytes.value], { type: 'application/pdf' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${file.value?.name?.replace(/\.pdf$/i, '') || 'publication'}-edited.pdf`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function runOcr(pageNumbers = missingTextPages.value.map((page) => page.pageNumber)) {
  if (!pdf.value || !pageNumbers.length) return
  isOcrRunning.value = true
  ocrPercent.value = 0
  error.value = ''
  try {
    const result = await ocrPages(pdf.value, pageNumbers, (progress) => {
      if (typeof progress.progress === 'number') ocrPercent.value = Math.round(progress.progress * 100)
    })
    pages.value = pages.value.map((page) => {
      const ocrResult = result.get(page.pageNumber)
      if (!ocrResult) return page
      const ocrText = ocrResult.text || ''
      return {
        ...page,
        ...ocrResult,
        text: page.hasText ? page.text : ocrText,
        ocrText,
        ocrWords: ocrResult.words,
        hasText: Boolean(page.hasText || ocrText.trim())
      }
    })
  } catch (cause) {
    error.value = cause?.message || 'OCR could not be completed.'
  } finally {
    isOcrRunning.value = false
  }
}

async function runMetadataOcr() {
  await runOcr(metadataOcrPageNumbers.value)
}

async function identifyNames() {
  if (!gnfinderConsent.value || !documentText.value.trim()) return
  const existingNewTaxonFlags = new Map()
  appearances.value.forEach((group) => {
    for (const name of [group.gnName, group.canonical]) {
      const key = normalizeIndexName(name)
      if (key) existingNewTaxonFlags.set(key, Boolean(group.isNewSpecies))
    }
  })
  isFindingNames.value = true
  gnfinderError.value = ''
  try {
    const found = await findNames(documentText.value)
    const pageBlocks = pages.value.map((page) => ({
      ...page,
      block: `--- Page ${page.pageNumber} ---\n${page.text}`.trim()
    }))
    let cursor = 0
    const ranges = pageBlocks.map((page) => {
      const range = { pageNumber: page.pageNumber, start: cursor, end: cursor + page.block.length, text: page.text }
      cursor += page.block.length + 2
      return range
    })
    const rows = []
    const seen = new Set()
    const addAppearance = (name, pageNumber, matchIndex = 0, textOrder = Number.MAX_SAFE_INTEGER, textEnd = Number.MAX_SAFE_INTEGER) => {
      const page = pageBlocks.find((entry) => entry.pageNumber === pageNumber)
      const identity = Number.isFinite(textOrder) && Number.isFinite(textEnd) && textEnd > textOrder
        ? `${pageNumber || 0}|${textOrder}|${textEnd}`
        : `${pageNumber || 0}|${name.name.toLocaleLowerCase()}|${matchIndex}`
      if (seen.has(identity)) return
      seen.add(identity)
      rows.push({
        id: `appearance-${rows.length}`,
        page: pageNumber,
        gnName: name.name,
        canonical: name.canonical,
        matchIndex,
        textOrder,
        textEnd,
        evidence: page?.text || '',
        taxonQuery: name.name,
        taxonSuggestions: [],
        taxonMatch: null,
        taxonLoading: false
      })
    }
    for (const name of found) {
      const offset = name.start
      const offsetPage = offset == null ? null : ranges.find((range) => offset >= range.start && offset < range.end)?.pageNumber
      const targetPages = pageBlocks
      let matchedAny = false
      for (const page of targetPages) {
        const term = name.name || name.canonical
        const pattern = term.split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
        const regex = new RegExp(pattern, 'gi')
        const matches = [...page.text.matchAll(regex)]
        matches.forEach((match, matchIndex) => addAppearance(name, page.pageNumber, matchIndex, match.index, match.index + match[0].length))
        matchedAny ||= matches.length > 0
      }
      if (!matchedAny) {
        const fallbackPage = offsetPage || ranges.find((range) => name.start != null && name.start >= range.start && name.start < range.end)?.pageNumber || null
        const fallbackRange = ranges.find((range) => range.pageNumber === fallbackPage)
        const fallbackOrder = offsetPage === fallbackPage && fallbackRange ? offset - fallbackRange.start : Number.MAX_SAFE_INTEGER
        addAppearance(name, fallbackPage, 0, fallbackOrder, fallbackOrder + (fallbackOrder < Number.MAX_SAFE_INTEGER ? name.name.length : 0))
      }
    }
    rows.sort((a, b) => (a.page || Number.MAX_SAFE_INTEGER) - (b.page || Number.MAX_SAFE_INTEGER) || a.textOrder - b.textOrder || (b.textEnd - b.textOrder) - (a.textEnd - a.textOrder))
    const uniqueRows = []
    let overlapGroup = []
    let overlapEnd = -1
    let overlapPage = null
    const keepLongestOverlap = () => {
      if (!overlapGroup.length) return
      const longest = overlapGroup.reduce((best, row) => (row.textEnd - row.textOrder) > (best.textEnd - best.textOrder) ? row : best)
      uniqueRows.push(longest)
      overlapGroup = []
      overlapEnd = -1
    }
    for (const row of rows) {
      const hasPosition = Number.isFinite(row.textOrder) && Number.isFinite(row.textEnd) && row.textOrder < Number.MAX_SAFE_INTEGER && row.textEnd > row.textOrder
      if (!hasPosition) {
        keepLongestOverlap()
        const key = `${row.page || 0}|${row.gnName.toLocaleLowerCase()}`
        if (!uniqueRows.some((existing) => `${existing.page || 0}|${existing.gnName.toLocaleLowerCase()}` === key)) uniqueRows.push(row)
        continue
      }
      if (overlapGroup.length && (row.page !== overlapPage || row.textOrder >= overlapEnd)) keepLongestOverlap()
      if (!overlapGroup.length) overlapPage = row.page
      overlapGroup.push(row)
      overlapEnd = Math.max(overlapEnd, row.textEnd)
    }
    keepLongestOverlap()
    uniqueRows.sort((a, b) => (a.page || Number.MAX_SAFE_INTEGER) - (b.page || Number.MAX_SAFE_INTEGER) || a.textOrder - b.textOrder)
    uniqueRows.forEach((row, index) => { row.id = `appearance-${index}` })
    const grouped = []
    const groupedAliases = new Map()
    let nextGroupId = 0
    for (const row of uniqueRows) {
      const aliases = [...new Set([normalizeIndexName(row.canonical), normalizeIndexName(row.gnName)].filter(Boolean))]
      const matchingGroups = [...new Set(aliases.map((alias) => groupedAliases.get(alias)).filter(Boolean))]
      let group = matchingGroups[0]
      if (!group) {
        group = {
          id: `name-index-${nextGroupId++}`,
          gnName: row.gnName,
          canonical: row.canonical,
          occurrences: [],
          pageNumbers: [],
          showOccurrences: false,
          isManual: false,
          taxonQuery: row.gnName,
          taxonSuggestions: [],
          taxonMatch: null,
          taxonLoading: false
        }
        grouped.push(group)
      }
      for (const duplicateGroup of matchingGroups.slice(1)) {
        if (duplicateGroup === group) continue
        group.occurrences.push(...duplicateGroup.occurrences)
        const duplicateIndex = grouped.indexOf(duplicateGroup)
        if (duplicateIndex >= 0) grouped.splice(duplicateIndex, 1)
        for (const [alias, value] of groupedAliases) {
          if (value === duplicateGroup) groupedAliases.set(alias, group)
        }
      }
      group.occurrences.push({ ...row, id: `occurrence-${row.id}` })
      aliases.forEach((alias) => groupedAliases.set(alias, group))
    }
    grouped.forEach((group) => {
      group.gnName = group.occurrences[0]?.gnName || group.gnName
      group.canonical = group.occurrences.find((occurrence) => occurrence.canonical)?.canonical || group.canonical
      group.taxonQuery = group.gnName
      sortIndexGroupOccurrences(group)
      const detectedAsNewTaxon = group.occurrences.some(isNewSpeciesDescription)
      const priorFlag = [group.gnName, group.canonical]
        .map(normalizeIndexName)
        .find((key) => existingNewTaxonFlags.has(key))
      group.isNewSpecies = priorFlag ? existingNewTaxonFlags.get(priorFlag) : detectedAsNewTaxon
    })
    grouped.sort((a, b) => {
      const firstA = a.occurrences[0]
      const firstB = b.occurrences[0]
      return (firstA?.page || Number.MAX_SAFE_INTEGER) - (firstB?.page || Number.MAX_SAFE_INTEGER) || (firstA?.textOrder || 0) - (firstB?.textOrder || 0)
    })
    appearances.value = grouped
    if (appearances.value.length) selectFirstOccurrence(appearances.value[0])
  } catch (cause) {
    gnfinderError.value = `${cause?.message || 'GNFinder could not be reached.'} Check your connection and whether the service permits browser requests, then try again.`
  } finally {
    isFindingNames.value = false
  }
}

function selectAppearance(appearance) {
  selectedAppearanceId.value = appearance.id
  if (appearance.page) previewPage.value = appearance.page
}

function selectFirstOccurrence(group) {
  if (group.occurrences.length) selectAppearance(group.occurrences[0])
}

function normalizeIndexName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isNewSpeciesDescription(occurrence) {
  const evidence = String(occurrence.evidence || '')
  const fallbackPosition = occurrence.gnName ? evidence.toLocaleLowerCase().indexOf(occurrence.gnName.toLocaleLowerCase()) : -1
  const position = Number.isFinite(occurrence.textOrder) && occurrence.textOrder < Number.MAX_SAFE_INTEGER
    ? occurrence.textOrder
    : fallbackPosition
  if (position < 0) return false
  const mentionEnd = Number.isFinite(occurrence.textEnd) && occurrence.textEnd < Number.MAX_SAFE_INTEGER
    ? occurrence.textEnd
    : position + String(occurrence.gnName || '').length
  const start = Math.max(0, position - 100)
  const end = Math.min(evidence.length, mentionEnd + 180)
  const context = evidence.slice(start, end).replace(/\s+/g, ' ')
  return /\b(?:n\.?\s*gen\.?(?:\s*nov\.?)?(?:\s*(?:et|&)\s*)?(?:\s*n\.?\s*)?sp\.?(?:\s*nov\.?)?|gen\.?\s*n\.?\s*sp\.?(?:\s*nov\.?)?|gen\.?\s*(?:et|&)\s*sp\.?\s*nov\.?|gen\.?\s*nov\.?[,]?\s*sp\.?\s*nov\.?|n\.?\s*sp\.?(?:\s*nov\.?)?|sp\.?\s*nov\.?|nov\.?\s*sp\.?|sp\.?\s*n\.?|new\s+species|species\s+new\s+to\s+science|described\s+as\s+new)\b/i.test(context)
}

function refreshIndexPages(group) {
  group.pageNumbers = [...new Set(group.occurrences
    .map((occurrence) => Number(occurrence.page))
    .filter((page) => Number.isInteger(page) && page > 0))]
    .sort((a, b) => a - b)
}

function pageIndexLabel(group) {
  const pageNumbers = [...new Map(group.occurrences
    .map((occurrence) => publicationPageForPdfPage(occurrence.page))
    .filter(Boolean)
    .map((page) => [`${page.prefix}:${page.number}`, page])).values()]
    .sort((a, b) => a.number - b.number || a.prefix.localeCompare(b.prefix))
  if (!pageNumbers.length) return '—'
  const ranges = []
  let start = pageNumbers[0]
  let end = start
  for (const page of pageNumbers.slice(1)) {
    if (page.prefix === end.prefix && page.number === end.number + 1) end = page
    else {
      ranges.push(formatPublicationPageRange(start, end))
      start = end = page
    }
  }
  ranges.push(formatPublicationPageRange(start, end))
  return ranges.join(', ')
}

function publicationPageForPdfPage(pdfPage) {
  const pageNumber = Number(pdfPage)
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return null

  const metadataStart = publicationPageStart()
  if (firstPageNumber.value != null && metadataStart) {
    if (pageNumber < firstPageNumber.value) return null
    return {
      prefix: metadataStart.prefix,
      number: metadataStart.number + pageNumber - firstPageNumber.value
    }
  }

  return { prefix: '', number: pageNumber }
}

function publicationPageStart() {
  const match = String(metadata.pages || '').trim().replace(/^pp?\.?\s*/i, '').match(/^([a-z]*)(\d+)/i)
  if (!match) return null
  return { prefix: match[1] || '', number: Number(match[2]) }
}

function publicationPageLabel(pdfPage) {
  const page = publicationPageForPdfPage(pdfPage)
  return page ? `${page.prefix}${page.number}` : ''
}

function manualPublicationPageInput(occurrence) {
  return publicationPageForPdfPage(occurrence?.page)?.number ?? ''
}

function pdfPageForPublicationPage(value) {
  const publicationPage = Number(value)
  if (!Number.isInteger(publicationPage) || publicationPage < 1) return null
  const metadataStart = publicationPageStart()
  const pdfPage = firstPageNumber.value != null && metadataStart
    ? firstPageNumber.value + publicationPage - metadataStart.number
    : publicationPage
  return pdfPage >= 1 ? pdfPage : null
}

function setManualPublicationPage(group, occurrence, value) {
  occurrence.page = pdfPageForPublicationPage(value)
  sortIndexGroupOccurrences(group)
  sortIndexRowsByPage()
}

function manualSpecimenPublicationPageInput(record) {
  return publicationPageForPdfPage(record?.page)?.number ?? ''
}

function updateSpecimenPublicationPage(record, value) {
  const pdfPage = pdfPageForPublicationPage(value)
  record.page = pdfPage ? String(pdfPage) : ''
  if (pdfPage) goToPreviewPage(pdfPage)
}

function updateOccurrencePublicationPage(group, occurrence, value) {
  setManualPublicationPage(group, occurrence, value)
  const retainedOccurrence = findIndexOccurrence(group, occurrence)
  if (retainedOccurrence) selectAppearance(retainedOccurrence)
}

function sortIndexGroupOccurrences(group) {
  group.occurrences.sort((a, b) => {
    const pageA = Number(a.page) || Number.MAX_SAFE_INTEGER
    const pageB = Number(b.page) || Number.MAX_SAFE_INTEGER
    return pageA - pageB || (a.textOrder ?? Number.MAX_SAFE_INTEGER) - (b.textOrder ?? Number.MAX_SAFE_INTEGER)
  })
  const retainedByPageAndName = new Map()
  group.occurrences = group.occurrences.filter((occurrence) => {
    const page = Number(occurrence.page)
    const name = normalizeIndexName(occurrence.canonical || occurrence.gnName || group.taxonMatch?.label || group.gnName)
    if (!Number.isInteger(page) || page < 1 || !name) return true
    const key = `${page}|${name}`
    const retained = retainedByPageAndName.get(key)
    if (retained) {
      if (selectedAppearanceId.value === occurrence.id) selectedAppearanceId.value = retained.id
      return false
    }
    retainedByPageAndName.set(key, occurrence)
    return true
  })
  if (group.occurrences.length <= 1) group.showOccurrences = false
  refreshIndexPages(group)
}

function findIndexOccurrence(group, target) {
  const targetName = normalizeIndexName(target.canonical || target.gnName || group.taxonMatch?.label || group.gnName)
  return group.occurrences.find((occurrence) => occurrence.id === target.id)
    || group.occurrences.find((occurrence) => Number(occurrence.page) === Number(target.page)
      && targetName
      && normalizeIndexName(occurrence.canonical || occurrence.gnName || group.taxonMatch?.label || group.gnName) === targetName)
}

function sortIndexRowsByPage() {
  const firstPage = (group) => group.occurrences.reduce((minimum, item) => {
    const page = Number(item.page)
    return Number.isInteger(page) && page > 0 ? Math.min(minimum, page) : minimum
  }, Number.MAX_SAFE_INTEGER)

  appearances.value = appearances.value
    .map((group, index) => ({ group, index }))
    .sort((a, b) => {
      const pageA = firstPage(a.group)
      const pageB = firstPage(b.group)
      const textOrderA = a.group.occurrences[0]?.textOrder ?? Number.MAX_SAFE_INTEGER
      const textOrderB = b.group.occurrences[0]?.textOrder ?? Number.MAX_SAFE_INTEGER
      return pageA - pageB || textOrderA - textOrderB || a.index - b.index
    })
    .map(({ group }) => group)
}

function addIndexAppearance(group, insertAt) {
  const id = globalThis.crypto?.randomUUID?.() || `manual-appearance-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const occurrence = {
    id,
    gnName: group.gnName,
    canonical: group.canonical || '',
    page: previewPage.value || 1,
    textOrder: Number.MAX_SAFE_INTEGER,
    textEnd: Number.MAX_SAFE_INTEGER,
    manual: true
  }
  group.occurrences.splice(Math.max(0, Math.min(insertAt, group.occurrences.length)), 0, occurrence)
  sortIndexGroupOccurrences(group)
  sortIndexRowsByPage()
  group.showOccurrences = group.occurrences.length > 1
  const retainedOccurrence = findIndexOccurrence(group, occurrence)
  selectedAppearanceId.value = retainedOccurrence?.id || occurrence.id
}

function formatPublicationPageRange(start, end) {
  const first = `${start.prefix}${start.number}`
  return start.number === end.number && start.prefix === end.prefix
    ? first
    : `${first}–${end.prefix}${end.number}`
}

function addIndexRow(insertAt = appearances.value.length) {
  const groupId = globalThis.crypto?.randomUUID?.() || `manual-name-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const page = previewPage.value || 1
  const occurrence = { id: `${groupId}-appearance`, page, gnName: '', canonical: '', textOrder: Number.MAX_SAFE_INTEGER, textEnd: Number.MAX_SAFE_INTEGER, manual: true }
  const group = { id: groupId, gnName: '', canonical: '', occurrences: [occurrence], pageNumbers: [page], showOccurrences: false, isManual: true, isNewSpecies: false, taxonQuery: '', taxonSuggestions: [], taxonMatch: null, taxonLoading: false }
  appearances.value.splice(Math.max(0, Math.min(insertAt, appearances.value.length)), 0, group)
  selectAppearance(occurrence)
}

function removeIndexRow(group) {
  clearTimeout(searchTimers.get(group.id))
  searchTimers.delete(group.id)
  const selected = selectedIndexGroupId.value === group.id
  appearances.value = appearances.value.filter((entry) => entry.id !== group.id)
  if (selected) {
    selectedAppearanceId.value = null
    if (appearances.value.length) selectFirstOccurrence(appearances.value[0])
  }
}

function removeIndexAppearance(group, occurrence) {
  if (group.occurrences.length <= 1) {
    removeIndexRow(group)
    return
  }
  const wasSelected = selectedAppearanceId.value === occurrence.id
  group.occurrences = group.occurrences.filter((item) => item.id !== occurrence.id)
  refreshIndexPages(group)
  if (group.occurrences.length === 1) group.showOccurrences = false
  if (wasSelected) selectFirstOccurrence(group)
}

function goToPreviewPage(pageNumber) {
  if (pageNumber >= 1 && pageNumber <= pages.value.length) {
    previewPage.value = pageNumber
    if (previewSurface.value) {
      previewSurface.value.scrollTop = 0
      previewSurface.value.scrollLeft = 0
    }
  }
}

function adjustPreviewZoom(amount) {
  previewZoom.value = Math.min(3, Math.max(0.5, Math.round((previewZoom.value + amount) * 100) / 100))
}

function markFirstPage() {
  if (previewPage.value >= 1 && previewPage.value <= pages.value.length) {
    firstPageNumber.value = previewPage.value
  }
}

function handlePreviewWheel(event) {
  if (!pages.value.length || event.ctrlKey || event.metaKey || Math.abs(event.deltaY) < 15 || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return
  const nextPage = previewPage.value + (event.deltaY > 0 ? 1 : -1)
  if (nextPage < 1 || nextPage > pages.value.length) return

  event.preventDefault()
  const now = Date.now()
  if (now - lastPreviewWheelAt < 450) return
  lastPreviewWheelAt = now
  goToPreviewPage(nextPage)
}

function searchTaxa(appearance, term) {
  appearance.taxonQuery = term
  appearance.taxonSuggestions = []
  appearance.taxonMatch = null
  appearance.taxonLoading = false
  clearTimeout(searchTimers.get(appearance.id))
  if (term.trim().length < 2) return
  appearance.taxonLoading = true
  const timer = setTimeout(async () => {
    try {
      const { data } = await makeAPIRequest.get('/taxon_names/autocomplete', {
        params: { term: term.trim(), exact: false }
      })
      if (appearance.taxonQuery !== term) return
      appearance.taxonSuggestions = (data || []).slice(0, 8).map((taxon) => ({
        id: taxon.id,
        label: String(taxon.cached_author_year || taxon.label || taxon.cached || taxon.name || `Taxon name ${taxon.id}`)
          .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#10003;/g, '').trim(),
        type: taxon.type || '',
        cachedOriginalCombination: taxon.cached_original_combination || ''
      }))
    } catch {
      appearance.taxonSuggestions = []
    } finally {
      appearance.taxonLoading = false
    }
  }, 300)
  searchTimers.set(appearance.id, timer)
}

function chooseTaxon(appearance, taxon) {
  appearance.taxonMatch = taxon
  appearance.taxonQuery = taxon.label
  appearance.taxonSuggestions = []
  const rowIndex = appearances.value.indexOf(appearance)
  if (rowIndex < 0) return

  const matchingGroup = appearances.value.find((group) =>
    group !== appearance && String(group.taxonMatch?.id) === String(taxon.id)
  )
  if (matchingGroup) {
    matchingGroup.occurrences.push(...appearance.occurrences)
    matchingGroup.isNewSpecies = Boolean(matchingGroup.isNewSpecies || appearance.isNewSpecies)
    sortIndexGroupOccurrences(matchingGroup)
    matchingGroup.showOccurrences = matchingGroup.occurrences.length > 1
    clearTimeout(searchTimers.get(appearance.id))
    searchTimers.delete(appearance.id)
    appearances.value.splice(rowIndex, 1)
    if (selectedTypeIndexGroupId.value === appearance.id) selectedTypeIndexGroupId.value = matchingGroup.id
  }
  sortIndexRowsByPage()
}

function clearTaxonMatch(appearance) {
  appearance.taxonMatch = null
  appearance.taxonQuery = ''
}

function downloadIndexCsv() {
  const csv = buildIndexCsv()
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${file.value?.name?.replace(/\.pdf$/i, '') || 'publication'}-name-index.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function buildIndexCsv() {
  const columns = ['nameInPublication', 'taxonWorksName', 'taxonNameID', 'pages']
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  return [columns.join(','), ...appearances.value.map((group) => [group.gnName || group.taxonMatch?.label || '', group.taxonMatch?.label || '', group.taxonMatch?.id || '', pageIndexLabel(group)].map(quote).join(','))].join('\r\n')
}

const referenceHeadingPattern = /^\s*(?:references|references\s+cited|literature\s+cited|bibliography|literature|referencias|bibliograf[ií]a|refer[eê]ncias)\s*:?\s*$/i
const referenceEndingHeadingPattern = /^\s*(?:acknowledg(?:e)?ments|appendix|appendices|index|author\s+contributions|funding|supplementary\s+material)\b/i

function looksLikeReferenceStart(line) {
  const clean = String(line || '').replace(/^\s*(?:\[\d+\]|\d+[.)])\s*/, '').trim()
  const year = /\b(?:17|18|19|20)\d{2}[a-z]?\b/i.exec(clean)
  if (!year || year.index < 3 || year.index > 145 || !/^[A-ZÀ-ÖØ-Þ]/u.test(clean)) return false
  const authorPrefix = clean.slice(0, year.index)
  const firstAuthorToken = authorPrefix.trim().split(/\s+/)[0]
  const surnameOnly = authorPrefix.trim().split(/\s+/).length === 1
    && /^[A-ZÀ-ÖØ-Þ][\p{L}'’-]+$/u.test(firstAuthorToken)
    && !/^(?:The|This|In|On|For|See|A|An|However|Thus|Table|Figure)$/i.test(firstAuthorToken)
  return /[,;]|\bet\s+al\b|\b[A-Z]\./i.test(authorPrefix)
    || authorPrefix.trim().split(/\s+/).length >= 2
    || surnameOnly
}

function extractReferenceBlocks() {
  const pageRows = pages.value.map((page) => ({ pageNumber: page.pageNumber, lines: String(page.ocrText || metadataTextForPage(page)).split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean) }))
  const hasSectionHeading = pageRows.some(({ lines }) => lines.some((line) => referenceHeadingPattern.test(line)))
  const blocks = []
  let capturing = !hasSectionHeading
  let activeBlock = null
  const flush = () => {
    if (activeBlock?.text.trim()) blocks.push(activeBlock)
    activeBlock = null
  }
  for (const page of pageRows) {
    for (const line of page.lines) {
      if (referenceHeadingPattern.test(line)) {
        flush()
        capturing = true
        continue
      }
      if (capturing && referenceEndingHeadingPattern.test(line)) {
        flush()
        if (hasSectionHeading) return blocks
        capturing = false
      }
      if (!capturing) continue
      if (looksLikeReferenceStart(line)) {
        flush()
        activeBlock = { pageNumber: page.pageNumber, text: line }
      } else if (activeBlock && line.length > 1) {
        activeBlock.text += ` ${line}`
      }
    }
  }
  flush()
  return blocks
}

function parseReferenceCitation(block) {
  const citation = String(block.text || '').replace(/\s+/g, ' ').trim()
  const doi = (citation.match(/\b10\.\d{4,9}\/[a-z0-9._;()/:+-]+/i)?.[0] || '').replace(/[.,;:)]+$/, '')
  const yearMatch = /\b(?:17|18|19|20)\d{2}[a-z]?\b/i.exec(citation)
  const year = yearMatch?.[0] || ''
  const authors = yearMatch ? citation.slice(0, yearMatch.index).replace(/^\s*(?:\[\d+\]|\d+[.)])\s*/, '').replace(/[\s,;:.]+$/, '') : ''
  let remainder = yearMatch ? citation.slice(yearMatch.index + year.length).replace(/^\s*[).,:;\-–—]+\s*/, '') : citation
  const doiIndex = remainder.search(/\b10\.\d{4,9}\//i)
  if (doiIndex >= 0) remainder = remainder.slice(0, doiIndex).replace(/[\s,;]+$/, '')
  const titleBoundary = remainder.search(/\.\s+(?=[A-Z“"'])/u)
  const title = (titleBoundary >= 0 ? remainder.slice(0, titleBoundary) : remainder).replace(/^["“]+|["”]+$/g, '').replace(/[.,;]+$/, '').trim()
  const publicationDetails = titleBoundary >= 0 ? remainder.slice(titleBoundary + 1).trim() : ''
  const volumeMatch = publicationDetails.match(/\b(?:vol(?:ume)?\.?\s*)?(\d+[A-Za-z]?)\s*(?:\(|,|:)/i)
  const pagesMatch = publicationDetails.match(/\bpp?\.?\s*([\w-]+(?:\s*[-–—]\s*[\w-]+)?)/i)
  const journal = volumeMatch ? publicationDetails.slice(0, volumeMatch.index).replace(/[\s.,;]+$/, '') : publicationDetails.replace(/[\s.,;]+$/, '')
  return { citation, authors, year, title, journal, volume: volumeMatch?.[1] || '', pages: pagesMatch?.[1] || '', doi }
}

function addReferenceRecord(seed = {}) {
  const recordId = globalThis.crypto?.randomUUID?.() || `reference-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const record = reactive({
    id: recordId,
    detailsOpen: true,
    manuallyAdded: false,
    originalPage: null,
    ocrCitation: '',
    doi: '',
    title: '',
    authors: '',
    year: '',
    journal: '',
    volume: '',
    pages: '',
    databaseMatch: null,
    matches: [],
    isSearching: false,
    isLookingUpDoi: false,
    matchMessage: '',
    searchRequestId: 0,
    ...seed
  })
  referenceRecords.value.push(record)
  return record
}

async function scanReferencesFromOcr() {
  if (!pages.value.length || isScanningReferences.value) return
  const scanId = ++referenceScanId
  isScanningReferences.value = true
  referenceScanMessage.value = ''
  bundleExportMessage.value = ''
  try {
    const pagesNeedingOcr = pages.value.filter((page) => !page.hasText && !page.ocrText).map((page) => page.pageNumber)
    if (pagesNeedingOcr.length) {
      await runOcr(pagesNeedingOcr)
      if (scanId !== referenceScanId || !file.value) return
    }
    const blocks = extractReferenceBlocks()
    const existing = new Set(referenceRecords.value.map((record) => normalizeIndexName(record.ocrCitation || record.title)))
    let added = 0
    for (const block of blocks) {
      const parsed = parseReferenceCitation(block)
      const identity = normalizeIndexName(parsed.title || parsed.citation)
      if (!identity || existing.has(identity)) continue
      existing.add(identity)
      addReferenceRecord({ ...parsed, originalPage: block.pageNumber, ocrCitation: block.text, manuallyAdded: false, detailsOpen: false })
      added += 1
    }
    referenceScanMessage.value = added
      ? `Found ${added} reference citation(s) in the OCR text. Review the fields and search each citation against the project bibliography.`
      : blocks.length
        ? 'The OCR reference text was already in the list; no duplicate rows were added.'
        : 'No reference-list entries were detected. You can add publications manually or run OCR on the reference pages first.'
  } catch {
    if (scanId === referenceScanId) referenceScanMessage.value = 'The document text could not be scanned for references. Try OCR on the reference pages, then scan again.'
  } finally {
    if (scanId === referenceScanId) isScanningReferences.value = false
  }
}

async function searchReferenceMatches(reference) {
  if (!hasPublicationSearchCriteria(reference)) return
  const requestId = ++reference.searchRequestId
  reference.isSearching = true
  reference.matches = []
  reference.matchMessage = ''
  try {
    const result = await findProjectPublicationMatches(reference, { tolerateOcrErrors: true })
    if (requestId !== reference.searchRequestId || !referenceRecords.value.includes(reference)) return
    reference.matches = result.matches
    reference.matchMessage = result.message || (result.matches.length ? '' : 'No likely project bibliography matches found. You can keep this as a new publication.')
  } catch {
    if (requestId === reference.searchRequestId) reference.matchMessage = 'The project bibliography could not be searched. Please try again.'
  } finally {
    if (requestId === reference.searchRequestId) reference.isSearching = false
  }
}

function useReferenceMatch(reference, match) {
  reference.databaseMatch = match
  for (const key of ['doi', 'title', 'authors', 'year', 'journal', 'volume', 'pages']) {
    if (!reference[key]?.trim() && match.fields?.[key]) reference[key] = String(match.fields[key])
  }
  reference.matches = []
  reference.matchMessage = `Matched to ${match.title} in the project bibliography.`
}

async function lookupReferenceDoi(reference) {
  const doi = parseDoi(reference.doi)
  if (!doi || reference.isLookingUpDoi) return
  reference.isLookingUpDoi = true
  try {
    const details = await lookupDoi(doi)
    for (const key of ['doi', 'title', 'authors', 'year', 'journal', 'volume', 'pages']) {
      if (!reference[key] && details[key]) reference[key] = String(details[key])
    }
    reference.matchMessage = 'DOI metadata found. Empty fields were filled; please review them.'
  } catch (cause) {
    reference.matchMessage = cause?.message || 'DOI lookup failed. You can enter the citation details manually.'
  } finally {
    reference.isLookingUpDoi = false
  }
}

function removeReferenceRecord(reference) {
  reference.searchRequestId += 1
  referenceRecords.value = referenceRecords.value.filter((record) => record !== reference)
}

function addTypeRecord(seed = {}) {
  const recordId = globalThis.crypto?.randomUUID?.() || `specimen-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const record = reactive({
    id: recordId,
    occurrenceID: `urn:uuid:${recordId}`,
    page: '',
    detailsOpen: true,
    nameInPublication: '',
    taxonQuery: '',
    taxonMatch: null,
    taxonSuggestions: [],
    taxonLoading: false,
    isType: false,
    isNewSpecies: false,
    typeStatus: '',
    institutionCode: '',
    repositoryId: '',
    repositoryMatch: null,
    repositoryQuery: '',
    repositorySuggestions: [],
    repositoryLoading: false,
    catalogNumber: '',
    country: '',
    countryMatch: null,
    countryQuery: '',
    countrySuggestions: [],
    countryLoading: false,
    stateProvince: '',
    stateProvinceMatch: null,
    stateProvinceQuery: '',
    stateProvinceSuggestions: [],
    stateProvinceLoading: false,
    county: '',
    countyMatch: null,
    countyQuery: '',
    countySuggestions: [],
    countyLoading: false,
    verbatimLocality: '',
    eventDate: '',
    verbatimEventDate: '',
    collectors: [],
    collectorQuery: '',
    collectorSuggestions: [],
    collectorLoading: false,
    recordedByOther: '',
    host: '',
    hostMatch: null,
    hostQuery: '',
    hostSuggestions: [],
    hostLoading: false,
    sex: '',
    lifeStage: '',
    individualCountMode: 'aggregate',
    individualCount: '',
    maleCount: '',
    femaleCount: '',
    decimalLatitude: '',
    decimalLongitude: '',
    verbatimElevation: '',
    occurrenceRemarks: '',
    specimenEvidence: '',
    ...seed
  })
  typeDataRecords.value.push(record)
  if (record.verbatimEventDate) normalizeSpecimenDate(record)
  typeDataExportMessage.value = ''
  return record
}

function addTypeRecordFromIndex() {
  const group = appearances.value.find((entry) => entry.id === selectedTypeIndexGroupId.value)
  if (!group) return
  const occurrence = group.occurrences?.find(isNewSpeciesDescription) || group.occurrences?.[0]
  const firstPage = occurrence?.page
  const context = specimenContextForIndexGroup(group, occurrence)
  const inferredStatus = inferTypeStatus(context)
  const hostGroup = inferIndexedHost(group, context)
  const record = addTypeRecord({
    page: firstPage ? String(firstPage) : '',
    nameInPublication: group.gnName || group.taxonMatch?.label || '',
    taxonQuery: group.taxonMatch?.label || group.gnName || '',
    taxonMatch: group.taxonMatch ? { ...group.taxonMatch } : null,
    isNewSpecies: Boolean(group.isNewSpecies),
    isType: Boolean(group.isNewSpecies || inferredStatus),
    typeStatus: inferredStatus,
    country: extractSpecimenLabel(context, /country/i),
    stateProvince: extractSpecimenLabel(context, /state|province|department/i),
    county: extractSpecimenLabel(context, /county|district/i),
    catalogNumber: extractSpecimenLabel(context, /(?:catalog(?:ue)?|specimen)\s*(?:no\.?|number|#)/i),
    verbatimLocality: extractSpecimenLabel(context, /(?:verbatim\s+)?locality|location/i),
    verbatimEventDate: extractSpecimenLabel(context, /(?:verbatim\s+)?date|collected\s+on/i),
    recordedByOther: extractSpecimenLabel(context, /collectors?|collected\s+by|leg\.?/i),
    sex: extractSpecimenLabel(context, /sex/i),
    host: hostGroup?.gnName || hostGroup?.taxonMatch?.label || '',
    hostMatch: hostGroup?.taxonMatch ? { ...hostGroup.taxonMatch } : null,
    hostQuery: hostGroup?.taxonMatch?.label || hostGroup?.gnName || '',
    specimenEvidence: context
  })
  if (record.verbatimEventDate) normalizeSpecimenDate(record)
  selectedTypeIndexGroupId.value = ''
}

function specimenContextForIndexGroup(group, occurrence = group.occurrences?.[0]) {
  const evidence = String(occurrence?.evidence || '')
  if (!evidence) return ''
  const fallbackPosition = occurrence?.gnName ? evidence.toLocaleLowerCase().indexOf(occurrence.gnName.toLocaleLowerCase()) : -1
  if ((!Number.isFinite(occurrence?.textOrder) || occurrence.textOrder >= Number.MAX_SAFE_INTEGER) && fallbackPosition < 0) return ''
  const position = Number.isFinite(occurrence?.textOrder) && occurrence.textOrder < Number.MAX_SAFE_INTEGER
    ? occurrence.textOrder
    : Math.max(0, fallbackPosition)
  const end = Number.isFinite(occurrence?.textEnd) && occurrence.textEnd < Number.MAX_SAFE_INTEGER
    ? occurrence.textEnd
    : position
  return evidence.slice(Math.max(0, position - 700), Math.min(evidence.length, end + 1400)).replace(/\s+/g, ' ').trim()
}

function inferTypeStatus(context) {
  const match = String(context || '').match(/\b(holotype|paratype|allotype|lectotype|paralectotype|neotype|syntype|cotype|topotype)\b/i)
  if (!match) return ''
  return typeStatusOptions.find((status) => status.toLocaleLowerCase() === match[1].toLocaleLowerCase()) || match[1]
}

function extractSpecimenLabel(context, labelPattern) {
  const escapedLabel = labelPattern.source
  const match = String(context || '').match(new RegExp(`(?:${escapedLabel})\\s*[:=]\\s*([^;\\n.]+)`, 'i'))
  return match?.[1]?.trim().replace(/[;,]+$/, '') || ''
}

function inferIndexedHost(group, context) {
  for (const candidate of appearances.value) {
    if (candidate === group) continue
    const candidateName = candidate.gnName || candidate.taxonMatch?.label
    if (!candidateName) continue
    const escaped = candidateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b(?:host(?:ed)?\\s+(?:on|by)|on|from|ex)\\s+(?:the\\s+)?${escaped}\\b`, 'i').test(context)) return candidate
  }
  return null
}

function specimenLocationSummary(record) {
  return [record.county, record.stateProvince, record.country, record.verbatimLocality].filter(Boolean).join(', ') || '—'
}

function searchSpecimenOptions(record, field, term) {
  const config = {
    host: { endpoint: '/taxon_names/autocomplete', params: { exact: false } },
    repository: { endpoint: '/repositories/autocomplete' },
    country: { endpoint: '/geographic_areas/autocomplete' },
    stateProvince: { endpoint: '/geographic_areas/autocomplete' },
    county: { endpoint: '/geographic_areas/autocomplete' },
    collector: { endpoint: '/people/autocomplete' }
  }[field]
  if (!config) return
  const query = String(term || '').trim()
  const suggestionsKey = `${field}Suggestions`
  const loadingKey = `${field}Loading`
  record[suggestionsKey] = []
  record[loadingKey] = false
  const timerKey = `${record.id}:${field}`
  clearTimeout(specimenSearchTimers.get(timerKey))
  if (query.length < 2) return
  record[loadingKey] = true
  const timer = setTimeout(async () => {
    try {
      const { data } = await makeAPIRequest.get(config.endpoint, { params: { term: query, ...config.params } })
      const currentTerm = field === 'collector' ? record.collectorQuery
        : ['country', 'stateProvince', 'county'].includes(field) ? record[field]
          : record[`${field}Query`]
      if (currentTerm !== query) return
      record[suggestionsKey] = (data || []).slice(0, 8).map((result) => {
        const label = String(field === 'host'
          ? (result.cached_author_year || result.label || result.label_html || result.cached || result.name || '')
          : (result.label || result.label_html || result.object_label || result.name || result.full_name || ''))
          .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#10003;/g, '').trim()
        return {
          id: result.id,
          label,
          type: field === 'host' ? (result.type || '') : '',
          code: result.acronym || result.institution_code || result.repository_code || result.code || result.short_name || '',
          raw: result
        }
      }).filter((result) => result.label)
    } catch {
      record[suggestionsKey] = []
    } finally {
      record[loadingKey] = false
    }
  }, 250)
  specimenSearchTimers.set(timerKey, timer)
}

function selectSpecimenMatch(record, field, match) {
  if (field === 'collector') {
    if (!record.collectors.some((collector) => collector.id != null && match.id != null
      ? String(collector.id) === String(match.id)
      : normalizeIndexName(collector.label) === normalizeIndexName(match.label))) record.collectors.push(match)
    record.collectorQuery = ''
    record.collectorSuggestions = []
    return
  }
  record[`${field}Match`] = match
  record[`${field}Query`] = match.label
  record[`${field}Suggestions`] = []
  if (field === 'repository') {
    record.institutionCode = match.code || match.label
    record.repositoryId = match.id || ''
  } else if (field === 'host') {
    record.host = match.label
  } else {
    record[field] = match.label
  }
}

function clearSpecimenMatch(record, field) {
  if (field === 'collector') return
  record[`${field}Match`] = null
  record[`${field}Query`] = ''
  record[`${field}Suggestions`] = []
  if (field === 'repository') {
    record.repositoryId = ''
    record.institutionCode = ''
  } else if (field === 'host') record.host = ''
  else record[field] = ''
}

function removeSpecimenCollector(record, collector) {
  record.collectors = record.collectors.filter((entry) => entry.id != null && collector.id != null
    ? String(entry.id) !== String(collector.id)
    : normalizeIndexName(entry.label) !== normalizeIndexName(collector.label))
}

function normalizeSpecimenDate(record) {
  const raw = String(record.verbatimEventDate || '').trim()
  if (!raw) {
    record.eventDate = ''
    return
  }
  const normalizeSingle = (value) => {
    const text = value.trim().replace(/^[\[({]+|[\])}.;,]+$/g, '')
    let match = text.match(/^(\d{4})(?:[-/.](\d{1,2})(?:[-/.](\d{1,2}))?)?$/)
    if (match) return validDwcDate(Number(match[1]), Number(match[2] || 0), Number(match[3] || 0))
    match = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
    if (match) {
      const first = Number(match[1])
      const second = Number(match[2])
      const month = first > 12 ? second : first
      const day = first > 12 ? first : second
      return validDwcDate(Number(match[3]), month, day)
    }
    match = text.match(/^(\d{1,2})\s+([A-Za-z]+)\.?[,]?\s+(\d{4})$/) || text.match(/^([A-Za-z]+)\.?\s+(\d{1,2})[,]?\s+(\d{4})$/)
    if (match) {
      const monthName = match[2].match(/^[A-Za-z]/) ? match[2] : match[1]
      const monthNumber = monthNameToNumber(monthName)
      const day = match[2].match(/^\d/) ? Number(match[2]) : Number(match[1])
      return validDwcDate(Number(match[3]), monthNumber, day)
    }
    match = text.match(/^([A-Za-z]+)\.?\s+(\d{4})$/)
    if (match) {
      const month = monthNameToNumber(match[1])
      return month ? validDwcDate(Number(match[2]), month, 0) : ''
    }
    return ''
  }
  const dayRange = raw.match(/^(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+([A-Za-z]+)\.?[,]?\s+(\d{4})$/)
  if (dayRange) {
    const month = monthNameToNumber(dayRange[3])
    const start = validDwcDate(Number(dayRange[4]), month, Number(dayRange[1]))
    const end = validDwcDate(Number(dayRange[4]), month, Number(dayRange[2]))
    record.eventDate = start && end ? `${start}/${end}` : ''
    return
  }
  const range = raw.split(/\s+(?:to|through|until)\s+|\s*[–—]\s*/i)
  if (range.length === 2) {
    const start = normalizeSingle(range[0])
    const end = normalizeSingle(range[1])
    record.eventDate = start && end ? `${start}/${end}` : ''
    return
  }
  record.eventDate = normalizeSingle(raw)
}

function monthNameToNumber(value) {
  const normalized = String(value || '').slice(0, 3).toLocaleLowerCase()
  const index = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(normalized)
  return index < 0 ? 0 : index + 1
}

function validDwcDate(year, month = 0, day = 0) {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return ''
  if (!month) return day ? '' : String(year).padStart(4, '0')
  if (!Number.isInteger(month) || month < 1 || month > 12) return ''
  const yearText = String(year).padStart(4, '0')
  if (!day) return `${yearText}-${String(month).padStart(2, '0')}`
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth) return ''
  return `${yearText}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function removeTypeRecord(record) {
  clearTimeout(searchTimers.get(record.id))
  searchTimers.delete(record.id)
  clearSpecimenRecordTimers(record)
  typeDataRecords.value = typeDataRecords.value.filter((entry) => entry.id !== record.id)
  typeDataExportMessage.value = ''
}

function clearSpecimenRecordTimers(record) {
  for (const [key, timer] of specimenSearchTimers) {
    if (!key.startsWith(`${record.id}:`)) continue
    clearTimeout(timer)
    specimenSearchTimers.delete(key)
  }
}

function typeStatusForExport(status, scientificName) {
  const cleanStatus = String(status || '').trim()
  if (!cleanStatus) return ''
  return /\s+of\s+/i.test(cleanStatus) ? cleanStatus : `${cleanStatus} of ${scientificName}`
}

function publicationReferenceForTypeData(page) {
  const citation = selectedMetadataSource.value?.citation || selectedMetadataSource.value?.metadata || [
    metadata.authors,
    metadata.year,
    metadata.title,
    metadata.journal,
    metadata.volume,
    metadata.pages
  ].filter(Boolean).join('. ')
  return [citation, page ? `page ${publicationPageLabel(page)}` : ''].filter(Boolean).join(', ')
}

function downloadTypeDataCsv() {
  if (exportableTypeRecords.value.length !== typeDataRecords.value.length || !exportableTypeRecords.value.length) {
    typeDataExportMessage.value = 'Every specimen record needs a species name, and each type specimen needs a type status.'
    return
  }
  const csv = buildTypeDataCsv()
  downloadTextFile(csv, `${file.value?.name?.replace(/\.pdf$/i, '') || 'publication'}-specimen-data-dwc.csv`, 'text/csv;charset=utf-8')
  typeDataExportMessage.value = `Downloaded ${typeDataRecords.value.length} specimen record(s) as a TaxonWorks-compatible DwC CSV.`
}

const typeDataCsvColumns = [
    'occurrenceID', 'basisOfRecord', 'type', 'scientificName', 'typeStatus', 'TW:TaxonDetermination:taxon_name_id', 'TW:Repository:repository_id', 'TW:Host:taxon_name_id',
    'institutionCode', 'catalogNumber', 'country', 'stateProvince', 'county',
    'verbatimLocality', 'verbatimEventDate', 'eventDate', 'recordedBy', 'associatedTaxa', 'sex', 'lifeStage',
    'individualCount', 'maleCount', 'femaleCount', 'decimalLatitude', 'decimalLongitude', 'verbatimElevation',
    'associatedReferences', 'occurrenceRemarks'
]

function specimenRecordRows() {
  return typeDataRecords.value.map((record) => {
    const scientificName = record.taxonMatch?.label || record.nameInPublication.trim() || record.taxonQuery.trim()
    const maleCount = Number(record.maleCount)
    const femaleCount = Number(record.femaleCount)
    const individualCount = record.individualCountMode === 'sexCounts'
      ? (record.maleCount !== '' || record.femaleCount !== '' ? (Number.isFinite(maleCount) ? maleCount : 0) + (Number.isFinite(femaleCount) ? femaleCount : 0) : '')
      : record.individualCount
    const sex = record.sex || (record.individualCountMode === 'sexCounts'
      ? (maleCount > 0 && femaleCount > 0 ? 'male and female' : maleCount > 0 ? 'male' : femaleCount > 0 ? 'female' : '')
      : '')
    const recordedBy = [...record.collectors.map((collector) => collector.label), record.recordedByOther].filter(Boolean).join('; ')
    return {
      occurrenceID: record.occurrenceID,
      basisOfRecord: 'PreservedSpecimen',
      type: 'PhysicalObject',
      scientificName,
      typeStatus: record.isType ? typeStatusForExport(record.typeStatus, scientificName) : '',
      'TW:TaxonDetermination:taxon_name_id': record.taxonMatch?.id || '',
      'TW:Repository:repository_id': record.repositoryId || '',
      'TW:Host:taxon_name_id': record.hostMatch?.id || '',
      institutionCode: record.institutionCode,
      catalogNumber: record.catalogNumber,
      country: record.country,
      stateProvince: record.stateProvince,
      county: record.county,
      verbatimLocality: record.verbatimLocality,
      verbatimEventDate: record.verbatimEventDate,
      eventDate: record.eventDate,
      recordedBy,
      associatedTaxa: record.hostMatch?.label ? `host: ${record.hostMatch.label}` : record.host ? `host: ${record.host}` : '',
      sex,
      lifeStage: record.lifeStage,
      individualCount,
      maleCount: record.individualCountMode === 'sexCounts' ? record.maleCount : '',
      femaleCount: record.individualCountMode === 'sexCounts' ? record.femaleCount : '',
      decimalLatitude: record.decimalLatitude,
      decimalLongitude: record.decimalLongitude,
      verbatimElevation: record.verbatimElevation,
      associatedReferences: publicationReferenceForTypeData(record.page),
      occurrenceRemarks: record.occurrenceRemarks
    }
  })
}

function buildTypeDataCsv() {
  const rows = specimenRecordRows()
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  return [typeDataCsvColumns.join(','), ...rows.map((row) => typeDataCsvColumns.map((column) => quote(row[column])).join(','))].join('\r\n')
}

function downloadReferencesBibtex() {
  if (incompleteReferenceRecords.value.length) return
  downloadTextFile(buildReferencesBibtex(), `${file.value?.name?.replace(/\.pdf$/i, '') || 'publication'}-references.bib`, 'application/x-bibtex;charset=utf-8')
}

function bibtexEscape(value) {
  return String(value || '')
    .replace(/([%&#_$])/g, '\\$1')
    .replace(/([{}])/g, '\\$1')
}

function buildReferencesBibtex() {
  const usedKeys = new Set()
  const entries = referenceRecords.value.filter((record) => ['doi', 'title', 'authors', 'year', 'journal', 'volume', 'pages'].some((field) => String(record[field] || '').trim())).map((record, index) => {
    const authorName = String(record.authors || '').split(/\s*(?:;|\band\b|&)\s*/i)[0]
    const surname = authorName.includes(',') ? authorName.split(',')[0] : authorName.trim().split(/\s+/).filter((word) => word.length > 1).at(-1)
    const titleWord = String(record.title).trim().split(/\s+/).slice(0, 2).join('')
    const baseKey = `${(surname || 'Reference').replace(/[^a-z0-9]/gi, '')}${record.year || ''}${titleWord.replace(/[^a-z0-9]/gi, '') || index + 1}`
    let key = baseKey
    let suffix = 2
    while (usedKeys.has(key.toLocaleLowerCase())) key = `${baseKey}${suffix++}`
    usedKeys.add(key.toLocaleLowerCase())
    const fields = [
      ['author', record.authors],
      ['title', record.title],
      ['journal', record.journal],
      ['year', record.year],
      ['volume', record.volume],
      ['pages', record.pages],
      ['doi', record.doi]
    ].filter(([, value]) => String(value || '').trim())
    return `@article{${key},\n${fields.map(([field, value]) => `  ${field} = {${bibtexEscape(value)}}`).join(',\n')}\n}`
  })
  return entries.join('\n\n')
}

function downloadTextFile(contents, name, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function buildOccurrenceArchiveText() {
  const fields = [
    'occurrenceID', 'basisOfRecord', 'type', 'scientificName', 'taxonID', 'typeStatus',
    'institutionCode', 'catalogNumber', 'country', 'stateProvince', 'county', 'verbatimLocality',
    'verbatimEventDate', 'eventDate', 'recordedBy', 'associatedTaxa', 'sex', 'lifeStage',
    'individualCount', 'decimalLatitude', 'decimalLongitude', 'verbatimElevation', 'dynamicProperties',
    'associatedReferences', 'occurrenceRemarks'
  ]
  const tabValue = (value) => `"${String(value ?? '').replace(/[\t\r\n]+/g, ' ').replace(/"/g, '""').trim()}"`
  const rows = specimenRecordRows().map((record) => {
    const properties = Object.fromEntries([
      ['taxonWorksRepositoryId', record['TW:Repository:repository_id']],
      ['taxonWorksHostTaxonNameId', record['TW:Host:taxon_name_id']],
      ['maleCount', record.maleCount],
      ['femaleCount', record.femaleCount]
    ].filter(([, value]) => value !== '' && value != null))
    const dynamicProperties = Object.keys(properties).length ? JSON.stringify(properties) : ''
    const archiveRecord = {
      ...record,
      taxonID: record['TW:TaxonDetermination:taxon_name_id'],
      dynamicProperties
    }
    return fields.map((field) => tabValue(archiveRecord[field])).join('\t')
  })
  return [fields.join('\t'), ...rows].join('\n') + '\n'
}

function buildDwcaMetadataXml() {
  const fields = [
    'occurrenceID', 'basisOfRecord', 'type', 'scientificName', 'taxonID', 'typeStatus',
    'institutionCode', 'catalogNumber', 'country', 'stateProvince', 'county', 'verbatimLocality',
    'verbatimEventDate', 'eventDate', 'recordedBy', 'associatedTaxa', 'sex', 'lifeStage',
    'individualCount', 'decimalLatitude', 'decimalLongitude', 'verbatimElevation', 'dynamicProperties',
    'associatedReferences', 'occurrenceRemarks'
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<archive xmlns="http://rs.tdwg.org/dwc/text/">\n  <core encoding="UTF-8" fieldsTerminatedBy="&#x9;" linesTerminatedBy="&#xA;" fieldsEnclosedBy="&quot;" ignoreHeaderLines="1" rowType="http://rs.tdwg.org/dwc/terms/Occurrence">\n    <files><location>occurrence.txt</location></files>\n    <id index="0"/>\n${fields.slice(1).map((field, index) => `    <field index="${index + 1}" term="http://rs.tdwg.org/dwc/terms/${field}"/>`).join('\n')}\n  </core>\n</archive>\n`
}

function zipCrc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function buildStoredZip(files) {
  const encoder = new TextEncoder()
  const localParts = []
  const centralParts = []
  let localOffset = 0
  let centralSize = 0
  const now = new Date()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = file.data instanceof Uint8Array ? file.data : encoder.encode(String(file.data ?? ''))
    const crc = zipCrc32(data)
    const localHeader = new Uint8Array(30 + name.length)
    const localView = new DataView(localHeader.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, 0, true)
    localView.setUint16(10, dosTime, true)
    localView.setUint16(12, dosDate, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, data.length, true)
    localView.setUint16(26, name.length, true)
    localView.setUint16(28, 0, true)
    localHeader.set(name, 30)
    localParts.push(localHeader, data)

    const centralHeader = new Uint8Array(46 + name.length)
    const centralView = new DataView(centralHeader.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, dosTime, true)
    centralView.setUint16(14, dosDate, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, localOffset, true)
    centralHeader.set(name, 46)
    centralParts.push(centralHeader)
    localOffset += localHeader.length + data.length
    centralSize += centralHeader.length
  }
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, localOffset, true)
  endView.setUint16(20, 0, true)
  const parts = [...localParts, ...centralParts, end]
  const size = parts.reduce((total, part) => total + part.length, 0)
  const zip = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    zip.set(part, offset)
    offset += part.length
  }
  return zip
}

function safePdfExportFilename() {
  const requested = pdfExportName.value.trim() || defaultPdfExportName.value
  const base = requested.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'publication'
  return `${base}.pdf`
}

function downloadPublicationBundle() {
  if (!currentPdfBytes.value) return
  const baseName = file.value?.name?.replace(/\.pdf$/i, '') || 'publication'
  const files = [
    { name: safePdfExportFilename(), data: currentPdfBytes.value },
    { name: `${baseName}-name-index.csv`, data: buildIndexCsv() },
    { name: 'occurrence.txt', data: buildOccurrenceArchiveText() },
    { name: 'meta.xml', data: buildDwcaMetadataXml() },
    { name: `${baseName}-references.bib`, data: buildReferencesBibtex() }
  ]
  const zip = buildStoredZip(files)
  downloadBlobFile(zip, `${baseName}-publication-package.zip`, 'application/zip')
  const bibtexReferenceCount = referenceRecords.value.filter((record) => ['doi', 'title', 'authors', 'year', 'journal', 'volume', 'pages'].some((field) => String(record[field] || '').trim())).length
  bundleExportMessage.value = `Downloaded a package with the modified PDF, name index, ${typeDataRecords.value.length} specimen row(s), and ${bibtexReferenceCount} reference(s) with citation data.`
}

function downloadBlobFile(contents, name, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function renderPreview() {
  const sequence = ++renderSequence
  if (previewRenderTask) {
    const previousTask = previewRenderTask
    previousTask.cancel()
    try {
      await previousTask.promise
    } catch {
      // PDF.js rejects a cancelled render task after it releases the canvas.
    }
    if (previewRenderTask === previousTask) previewRenderTask = null
  }
  if (sequence !== renderSequence || !pdf.value || !pdfCanvas.value || !previewSurface.value || !previewPage.value) return
  isRenderingPage.value = true
  highlightRects.value = []
  searchHighlightRects.value = []
  highlightBounds.value = null
  try {
    const page = await pdf.value.getPage(previewPage.value)
    if (sequence !== renderSequence) return
    const baseViewport = page.getViewport({ scale: 1 })
    const fitScale = Math.min(1.5, Math.max(.5, (previewSurface.value.clientWidth - 28) / baseViewport.width))
    const scale = fitScale * previewZoom.value
    const viewport = page.getViewport({ scale })
    const canvas = pdfCanvas.value
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    const task = page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport })
    previewRenderTask = task
    try {
      await task.promise
    } finally {
      if (previewRenderTask === task) previewRenderTask = null
    }
    if (sequence !== renderSequence) return
    const appearance = selectedAppearance.value
    const loadedPage = pages.value.find((entry) => entry.pageNumber === previewPage.value)
    const appearanceOnPage = appearance?.page === previewPage.value
    const searchPhrases = previewPage.value === metadataMatchPage.value ? metadataSearchPhrases.value : []
    if (appearanceOnPage || searchPhrases.length) {
      const textContent = await page.getTextContent()
      if (sequence !== renderSequence) return
      if (appearanceOnPage) {
        let rectangles = nameHighlightRects(textContent.items, viewport, appearance.gnName, appearance.matchIndex)
        if (!rectangles.length && appearance.canonical) rectangles = nameHighlightRects(textContent.items, viewport, appearance.canonical, appearance.matchIndex)
        if (!rectangles.length && loadedPage?.ocrWords?.length) {
          rectangles = ocrNameHighlightRects(loadedPage.ocrWords, loadedPage.width, loadedPage.height, viewport, appearance.gnName, appearance.matchIndex)
        }
        const leftOffset = (previewSurface.value.clientWidth - viewport.width) / 2
        highlightRects.value = rectangles.map((rect) => ({ ...rect, left: rect.left + leftOffset, top: rect.top + 14 }))
      }
      if (searchPhrases.length) {
        const searchRects = searchPhrases.flatMap((phrase) => {
          let rectangles = nameHighlightRects(textContent.items, viewport, phrase, null)
          if (!rectangles.length && loadedPage?.ocrWords?.length) {
            rectangles = ocrNameHighlightRects(loadedPage.ocrWords, loadedPage.width, loadedPage.height, viewport, phrase, null)
          }
          return rectangles
        })
        const leftOffset = (previewSurface.value.clientWidth - viewport.width) / 2
        searchHighlightRects.value = searchRects.map((rect) => ({ ...rect, left: rect.left + leftOffset, top: rect.top + 14 }))
      }
      if (highlightRects.value.length && sequence === renderSequence && previewSurface.value) {
        const left = Math.min(...highlightRects.value.map((rect) => rect.left))
        const top = Math.min(...highlightRects.value.map((rect) => rect.top))
        const right = Math.max(...highlightRects.value.map((rect) => rect.left + rect.width))
        const bottom = Math.max(...highlightRects.value.map((rect) => rect.top + rect.height))
        highlightBounds.value = { left, top, width: right - left, height: bottom - top }
        await nextTick()
        const surface = previewSurface.value
        const focus = highlightFocus.value
        if (sequence === renderSequence && surface && focus) {
          const surfaceBox = surface.getBoundingClientRect()
          const focusBox = focus.getBoundingClientRect()
          const focusTop = surface.scrollTop + focusBox.top - surfaceBox.top - surface.clientTop
          surface.scrollTo({
            top: Math.max(0, focusTop + focusBox.height / 2 - surface.clientHeight / 2),
            behavior: 'smooth'
          })
        }
      }
    }
  } catch (cause) {
    if (cause?.name !== 'RenderingCancelledException' && sequence === renderSequence) {
      error.value = cause?.message || 'The PDF page could not be rendered.'
    }
  } finally {
    if (sequence === renderSequence) isRenderingPage.value = false
  }
}

watch(() => [metadata.doi, metadata.title, metadata.authors, metadata.year, metadata.journal, metadata.volume], () => {
  if (skipMetadataFieldSearch) return
  metadataSearchId += 1
  clearTimeout(metadataSearchTimer)
  metadataMatches.value = []
  metadataMatchMessage.value = ''
  isFindingMetadataMatches.value = false
  hasCompletedMetadataSearch.value = false
  if (selectedMetadataSource.value) return
  if (hasPublicationSearchCriteria(metadata)) {
    metadataSearchTimer = setTimeout(() => { void searchMetadataMatches() }, 500)
  }
}, { flush: 'sync' })
watch([pdf, previewPage, previewZoom, selectedAppearanceId, pages, metadataSearchPhrases], () => { void nextTick(renderPreview) }, { flush: 'post' })
watch(previewSurface, (surface) => {
  previewResizeObserver?.disconnect()
  previewResizeObserver = null
  if (!surface || typeof ResizeObserver === 'undefined') return

  let previousSize = ''
  previewResizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return
    const nextSize = `${entry.contentRect.width}:${entry.contentRect.height}`
    if (previousSize && nextSize !== previousSize && pdf.value) void renderPreview()
    previousSize = nextSize
  })
  previewResizeObserver.observe(surface)
}, { flush: 'post' })
onBeforeUnmount(() => {
  renderSequence += 1
  previewRenderTask?.cancel()
  previewResizeObserver?.disconnect()
  searchTimers.forEach(clearTimeout)
  specimenSearchTimers.forEach(clearTimeout)
  clearTimeout(metadataSearchTimer)
  disposePdfLoadingTask(pdfLoadingTask.value)
})
</script>

<style scoped>
.processor-page{max-width:1440px;margin:0 auto;padding:2rem clamp(1rem,3vw,3rem) 3rem;color:#183442}.page-heading{max-width:850px;margin:0 auto 1.5rem}.eyebrow{margin:0 0 .35rem;color:#367f98;font-size:.78rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.page-heading h1{margin:.1rem 0 .5rem;font-size:clamp(1.8rem,3vw,2.5rem);line-height:1.15}.page-heading>p:last-child{margin:0;color:#5b7280;line-height:1.55}.panel{background:#fff;border:1px solid #d9e2e8;border-radius:14px;box-shadow:0 2px 10px #173c4a0d;padding:1.25rem}.upload-panel{max-width:1100px;margin:0 auto 1.25rem}.panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1rem}.panel-heading h2{margin:0;font-size:1.15rem}.panel-heading p{margin:.3rem 0 0;color:#6a7d88;font-size:.9rem;line-height:1.45}.file-drop{min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.3rem;border:2px dashed #b7cbd4;border-radius:12px;background:#f8fbfc;cursor:pointer;text-align:center}.file-drop:hover{border-color:#367f98;background:#f3f9fb}.file-drop input{position:absolute;width:1px;height:1px;opacity:0}.file-drop strong{overflow-wrap:anywhere;padding:0 1rem}.file-drop>span:last-child{color:#758895;font-size:.84rem}.file-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#e4f1f5;color:#26718a;font-size:1.2rem;font-weight:700}.document-summary,.action-row,.ocr-controls,.privacy-note{margin-top:1rem}.document-summary{display:flex;align-items:center;gap:.55rem;color:#536c78;font-size:.9rem}.status-dot{width:9px;height:9px;border-radius:50%;flex:none}.status-warning{background:#df9c26}.status-ready{background:#2f9872}.ocr-controls{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem;background:#f7fafb;border-radius:10px}.ocr-controls p{margin:0;color:#607985;font-size:.88rem;line-height:1.45}.privacy-note{padding:.85rem 1rem;background:#f4f7fa;border-radius:9px;color:#536c78;font-size:.86rem;line-height:1.5}.consent-row{display:flex;align-items:flex-start;gap:.5rem;margin-top:.65rem;color:#183442;font-weight:600}.consent-row input{margin-top:.25rem;accent-color:#367f98}.action-row{display:flex;flex-wrap:wrap;gap:.65rem}.primary-button,.secondary-button,.text-button,.remove-button{border:0;border-radius:8px;cursor:pointer;font:inherit}.primary-button{padding:.7rem 1rem;background:#347f98;color:white;font-weight:700}.primary-button:hover:not(:disabled){background:#286c83}.primary-button:disabled{opacity:.5;cursor:not-allowed}.secondary-button{padding:.58rem .85rem;border:1px solid #c9d8de;background:#fff;color:#2e687e}.secondary-button:hover,.text-button:hover{background:#f2f8fa}.text-button{padding:.35rem .55rem;background:transparent;color:#2e7188}.results-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:1.25rem;align-items:start}.text-panel{grid-row:span 2}.document-text{max-height:540px;overflow:auto;margin:0;padding:.85rem;border-radius:8px;background:#f7f9fa;color:#435a65;font: .83rem/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap}.muted-copy{margin:.35rem 0;color:#71848e;font-size:.9rem;line-height:1.5}.pdf-preview{margin-top:1rem;color:#2c7086;font-weight:600}.pdf-preview iframe{display:block;width:100%;height:480px;margin-top:.65rem;border:1px solid #d9e2e8;border-radius:8px}.count-badge{display:inline-flex;min-width:1.8rem;height:1.8rem;align-items:center;justify-content:center;padding:0 .45rem;border-radius:999px;background:#e7f2f5;color:#266e85;font-size:.83rem;font-weight:800}.name-list{display:grid;gap:.55rem;margin:0;padding:0;list-style:none}.name-list li{display:grid;gap:.18rem;padding:.65rem .75rem;border:1px solid #e4eaed;border-radius:8px;overflow-wrap:anywhere}.name-list small{color:#72838d}.candidate-list{display:grid;gap:.75rem;max-height:650px;overflow:auto;padding-right:.2rem}.candidate-card{padding:.8rem;border:1px solid #e0e7ea;border-radius:10px}.candidate-topline,.panel-tools{display:flex;align-items:center;gap:.5rem}.candidate-topline{margin-bottom:.65rem}.type-badge{padding:.25rem .5rem;border-radius:999px;background:#e8f3f5;color:#246f86;font-size:.75rem;font-weight:800}.page-label{color:#788892;font-size:.8rem}.remove-button{margin-left:auto;padding:.25rem .45rem;background:#fff1ef;color:#9b453b;font-size:.78rem}.candidate-card label{display:block;margin-top:.55rem;color:#536a75;font-size:.78rem;font-weight:700}.candidate-card textarea{display:block;width:100%;margin-top:.25rem;padding:.55rem;border:1px solid #d2dde2;border-radius:7px;color:#253f4b;font:400 .88rem/1.4 inherit;resize:vertical}.notice{padding:.75rem .9rem;border-radius:8px;line-height:1.45}.error-notice{background:#fff1ef;color:#903e35}.disclaimer{max-width:1100px;margin:1rem auto 0;color:#71818a;font-size:.82rem;line-height:1.5}.privacy-note strong{color:#314c58}@media(max-width:850px){.results-grid{grid-template-columns:1fr}.text-panel{grid-row:auto}.pdf-preview iframe{height:360px}}@media(max-width:560px){.processor-page{padding:1.25rem .8rem 2rem}.panel{padding:1rem}.panel-heading{align-items:flex-start}.ocr-controls{align-items:flex-start;flex-direction:column}.action-row>*{width:100%}}
.task-panel-stack{grid-column:2;display:grid;align-content:start;gap:1.25rem;min-width:0}.task-panel-stack>*{min-width:0}.preview-navigation{display:flex;align-items:center;gap:.5rem;color:#566d78;font-size:.85rem}.pdf-page-surface{position:relative;display:flex;justify-content:center;min-height:180px;overflow:auto;padding:14px;background:#eef2f4;border:1px solid #dbe4e8;border-radius:9px}.pdf-page-surface canvas{display:block;max-width:none;box-shadow:0 1px 8px #142b3633}.pdf-page-surface.is-rendering{opacity:.75}.pdf-highlight{position:absolute;background:#ffdc4d77;border:2px solid #e2a900;border-radius:2px;pointer-events:none;mix-blend-mode:multiply}.rendering-label{position:absolute;top:1rem;left:1rem;margin:0;padding:.35rem .55rem;border-radius:5px;background:#fff;color:#475e68;font-size:.8rem}.highlight-note{margin:.5rem 0 0;color:#77621a;font-size:.82rem}.text-details{margin-top:1rem;color:#2c7086;font-weight:600}.document-text{margin-top:.6rem}.appearance-table-wrap{overflow:auto;max-height:680px;border:1px solid #dce5e9;border-radius:9px}.appearance-table{width:100%;min-width:820px;border-collapse:separate;border-spacing:0;font-size:.88rem}.appearance-table th{position:sticky;top:0;z-index:1;padding:.75rem .6rem;background:#f3f7f8;color:#526a76;text-align:left;white-space:nowrap}.appearance-table td{padding:.55rem .45rem;border-top:1px solid #e6ecef;vertical-align:top}.appearance-table tbody tr{cursor:pointer}.appearance-table tbody tr:hover,.appearance-table tbody tr.selected-row{background:#fff9dc}.appearance-table td input{width:100%;min-width:90px;padding:.48rem .5rem;border:1px solid #d2dde2;border-radius:6px;color:#29434f;font:inherit}.page-index-cell{min-width:95px;color:#526a76;font-weight:700;white-space:nowrap}.page-index-cell input{display:block;width:82px!important;min-width:0!important;margin-top:.35rem}.gn-name-cell{min-width:190px;max-width:300px;overflow-wrap:anywhere}.gn-name-cell small{display:block;margin-top:.2rem;color:#72838d;font-size:.75rem}.taxon-cell{position:relative;min-width:220px}.taxon-search{position:relative}.taxon-search input{min-width:210px!important}.taxon-options{position:absolute;top:calc(100% + 3px);left:0;z-index:5;width:min(330px,70vw);max-height:220px;overflow:auto;padding:.25rem;background:white;border:1px solid #cbd9df;border-radius:7px;box-shadow:0 6px 18px #173c4a24}.taxon-options button{display:block;width:100%;padding:.5rem;text-align:left;border:0;border-radius:4px;background:white;color:#264956;font:inherit;cursor:pointer}.taxon-options button:hover{background:#edf5f7}.lookup-status{display:block;margin-top:.25rem;color:#758892;font-size:.72rem}.selected-taxon{display:flex;align-items:center;gap:.35rem;min-width:180px;padding:.35rem .45rem;background:#e8f3f5;border-radius:6px;color:#236b81}.selected-taxon span{overflow-wrap:anywhere}.selected-taxon button{flex:none;border:0;background:none;color:#236b81;font-size:1rem;cursor:pointer}.panel-tools{flex-wrap:wrap;justify-content:flex-end}.panel-tools .primary-button{white-space:nowrap}.index-actions{min-width:190px;display:flex;align-items:flex-start;gap:.25rem;flex-wrap:wrap}.subsequent-row{background:#f6fafb}.subsequent-row td{padding:.7rem!important}.subsequent-list{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;color:#59717c;font-size:.82rem}.subsequent-list .secondary-button{display:flex;align-items:baseline;gap:.35rem}.subsequent-list small{font-size:.72rem;color:#72838d}.current-occurrence{border-color:#367f98!important;background:#edf7fa!important}.appearance-table .remove-button{margin-left:0}@media(max-width:850px){.preview-navigation .secondary-button{padding:.45rem .6rem}.panel-tools{justify-content:flex-start}}
.file-drop.is-drag-over{border-color:#267b98;background:#eaf5f8;box-shadow:0 0 0 4px #367f9822;transform:translateY(-1px)}.file-drop.is-drag-over .file-icon{background:#367f98;color:#fff}.file-drop:focus-within{outline:3px solid #367f9855;outline-offset:3px}
@media(min-width:1100px){.results-grid{grid-template-columns:minmax(400px,1.05fr) minmax(0,1.45fr);align-items:start}.results-grid>.pdf-panel{grid-column:1;grid-row:1;position:sticky;top:1rem;align-self:start}.results-grid>.task-panel-stack{grid-column:2;grid-row:1}.pdf-page-surface{max-height:calc(100vh - 260px)}}@media(max-width:1099px){.results-grid>.pdf-panel,.results-grid>.task-panel-stack{grid-column:1/-1}.results-grid>.pdf-panel{position:static}}
.pdf-highlight-focus{position:absolute;pointer-events:none;scroll-margin-block:1rem;opacity:0}.pdf-page-surface{max-height:calc(100vh - 260px);overscroll-behavior:contain;scroll-padding-block:1rem}.pdf-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:.35rem;flex:none}.pdf-tool-icon{display:inline-flex;width:36px;height:36px;align-items:center;justify-content:center;padding:.4rem}.pdf-tool-icon svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.remove-page-button{padding:.58rem .85rem;border:1px solid #e5b7b1;border-radius:8px;background:#fff5f3;color:#963e35;font:inherit;cursor:pointer}.pdf-tool-icon.remove-page-button{padding:.4rem}.remove-page-button:hover:not(:disabled){background:#ffe9e5}.remove-page-button:disabled{opacity:.5;cursor:not-allowed}
.metadata-fields{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:.75rem}.metadata-field{grid-column:span 3;display:grid;align-content:start;gap:.3rem;min-width:0;color:#526b76;font-size:.76rem;font-weight:700}.metadata-field.wide{grid-column:span 12}.metadata-field.year-field{grid-column:span 3}.metadata-field.title-field{grid-column:span 12}.metadata-field.journal-field{grid-column:span 8}.metadata-field input{width:100%;min-width:0;min-height:38px;box-sizing:border-box;padding:.5rem .65rem;border:1px solid #d2dde2;border-radius:6px;background:#f8fafb;color:#29434f;font-family:inherit;font-size:.88rem;line-height:1.3}.metadata-field input:focus{border-color:#367f98;outline:2px solid #367f9826}.metadata-input-row{display:flex;gap:.45rem}.metadata-input-row input{flex:1}.metadata-matches{margin-top:1rem;padding:.85rem 1rem;border:1px solid #f0d982;border-radius:9px;background:#fffbeb;color:#5e4a13;font-size:.86rem}.metadata-match-heading{display:flex;align-items:center;justify-content:space-between;gap:.8rem}.metadata-matches>p{margin:.45rem 0 0}.metadata-matches ol{display:grid;gap:.5rem;max-height:220px;overflow:auto;margin:.6rem 0 0;padding-left:1.25rem}.metadata-matches li a{color:#1678a5;font-weight:700}.metadata-matches li small{display:block;margin-top:.15rem;color:#766b50}.metadata-footer{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1rem;padding-top:1rem;border-top:1px solid #e3e9ec}.metadata-footer>span{color:#6c7f88;font-size:.8rem;line-height:1.45}.metadata-footer .primary-button{white-space:nowrap}@media(max-width:600px){.metadata-field,.metadata-field.year-field{grid-column:span 12}.metadata-field.title-field,.metadata-field.journal-field{grid-column:span 12}.metadata-footer{align-items:stretch;flex-direction:column}.metadata-footer .primary-button{width:100%}.metadata-input-row{flex-wrap:wrap}.metadata-input-row .secondary-button{flex:1}}
.metadata-actions{display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;justify-content:flex-end}
.metadata-page-picker{display:flex;align-items:center;gap:.35rem;color:#526b76;font-size:.76rem;font-weight:700}.metadata-page-picker select{min-height:36px;padding:.4rem .55rem;border:1px solid #c9d8de;border-radius:7px;background:#fff;color:#29434f;font:inherit}
.metadata-match-result{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem}.metadata-match-actions{display:flex;align-items:flex-start;gap:.4rem;flex:none}.metadata-match-use-button{flex:none;padding:.38rem .6rem;font-size:.78rem}.metadata-match-evidence{display:grid;gap:.2rem;margin-top:.4rem;padding:.45rem .6rem;border-left:3px solid #1681ad;border-radius:4px;background:#edf7fa;color:#355b69;font-size:.8rem}.metadata-match-evidence q{overflow-wrap:anywhere;quotes:none}
@media(max-width:560px){.metadata-match-result{flex-direction:column}.metadata-match-actions{flex-wrap:wrap}.metadata-match-use-button{align-self:flex-start}}
.selected-source-panel .panel-heading{margin-bottom:.5rem}.selected-source-panel .panel-heading button{white-space:nowrap}.selected-source-citation{margin:0;padding:.75rem .9rem;border-radius:8px;background:#f3f6fa;color:#4d6170;font-size:.86rem;line-height:1.5}
.pdf-search-highlight{position:absolute;background:#39a8d955;border:2px solid #1681ad;border-radius:2px;pointer-events:none;mix-blend-mode:multiply}.search-highlight-note{color:#24718f}
.appearance-table{min-width:760px}.index-name-row,.subsequent-name{display:flex;align-items:center;gap:.4rem;min-width:0}.index-name-row>.publication-name{flex:1;overflow-wrap:anywhere}.icon-button{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;flex:none;padding:0;border:1px solid transparent;border-radius:6px;background:transparent;cursor:pointer}.icon-button svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.trash-button{color:#8b6060}.trash-button:hover{border-color:#efceca;background:#fff1ef;color:#a43930}.expand-appearances{display:flex;align-items:center;gap:.3rem;margin-top:.4rem;padding:.2rem 0;border:0;background:transparent;color:#327990;font:inherit;font-size:.78rem;cursor:pointer}.expand-appearances:hover{text-decoration:underline}.expand-appearances svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transform:rotate(-90deg);transition:transform .15s ease}.expand-appearances svg.is-expanded{transform:rotate(0)}.subsequent-name{padding-left:1rem;color:#536b77}.subsequent-name>span:first-child{color:#7b929d}.subsequent-name small{color:#72838d;font-size:.75rem;white-space:nowrap}.subsequent-name .trash-button{margin-left:auto}.subsequent-row{cursor:pointer}.subsequent-row:hover td,.subsequent-row.current-occurrence-row td{background:#fff9dc}
.insert-index-row td,.appearance-insert-row td{height:0;padding:0!important;border:0!important;background:transparent!important}.insert-index-row,.appearance-insert-row{height:0;cursor:default!important}.insert-index-row:hover,.appearance-insert-row:hover{background:transparent!important}.insert-overlay-cell{position:relative}.insert-overlay-cell .insert-index-button{position:absolute;z-index:2;top:-12px;left:23.5%;transform:translateX(-50%)}.insert-overlay-cell .insert-index-button:hover{transform:translateX(-50%) scale(1.08)}.subsequent-row .page-index-cell input{margin-top:0}.insert-index-button{display:inline-flex;width:23px;height:23px;align-items:center;justify-content:center;padding:0;border:1px solid #c8d8de;border-radius:50%;background:#fff;color:#327990;cursor:pointer;transition:background .15s ease,border-color .15s ease,transform .15s ease}.insert-index-button:hover{transform:scale(1.08);border-color:#327990;background:#edf7fa}.insert-index-button svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}.empty-index-state{display:flex;align-items:center;gap:.8rem;padding:.4rem 0}.empty-index-state .muted-copy{margin:0}
.pdf-panel>.panel-heading{display:flex;flex-direction:column;gap:.55rem}.pdf-toolbar{width:100%;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:.45rem}.first-page-controls,.pdf-toolbar-control-row{display:flex;align-items:center;gap:.3rem;flex-wrap:wrap}.first-page-controls{width:100%;justify-content:center}.pdf-toolbar .secondary-button{padding:.4rem}.preview-navigation,.preview-zoom-controls{display:flex;align-items:center;gap:.25rem;white-space:nowrap}.preview-navigation span{min-width:3.6rem;text-align:center}.preview-zoom-controls span{min-width:2.8rem;text-align:center;color:#566d78;font-size:.82rem}.first-page-badge{min-width:0;padding:.25rem .45rem;border-radius:999px;background:#e7f2f5;color:#266e85;font-size:.72rem;font-weight:700}.mark-first-page-button{min-height:36px;white-space:nowrap}

.type-data-tools{flex-wrap:wrap;justify-content:flex-end}.type-data-tools select{min-height:36px;max-width:260px;padding:.4rem .55rem;border:1px solid #c9d8de;border-radius:7px;background:#fff;color:#29434f;font:inherit}.dwc-import-note{margin:0 0 1rem;padding:.7rem .85rem;border-radius:8px;background:#f3f7f8;color:#526b76;font-size:.84rem;line-height:1.5}.type-record-list{display:grid;gap:1rem}.type-record-card{padding:1rem;border:1px solid #dbe5e9;border-radius:10px;background:#fbfcfd}.type-record-heading{display:flex;align-items:center;gap:.8rem;margin-bottom:.85rem;color:#29434f}.type-record-heading>strong{margin-right:auto}.type-record-page{display:flex;align-items:center;gap:.4rem;color:#526b76;font-size:.8rem;font-weight:700}.type-record-page input{width:72px;min-height:34px;padding:.4rem .5rem;border:1px solid #d2dde2;border-radius:6px;background:white;color:#29434f;font:inherit}.type-record-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7rem}.type-record-field{position:relative;display:grid;align-content:start;gap:.3rem;min-width:0;color:#526b76;font-size:.76rem;font-weight:700}.type-record-field input{width:100%;min-width:0;min-height:38px;box-sizing:border-box;padding:.5rem .65rem;border:1px solid #d2dde2;border-radius:6px;background:#fff;color:#29434f;font-family:inherit;font-size:.88rem;line-height:1.3}.type-record-field input:focus,.type-record-page input:focus{border-color:#367f98;outline:2px solid #367f9826}.type-record-wide{grid-column:span 2}.type-record-export-hint{display:block;margin-top:.8rem;color:#72838d;font-size:.76rem;overflow-wrap:anywhere}.type-record-fields .selected-taxon{min-height:38px;box-sizing:border-box}.type-record-fields .taxon-search input{min-width:0}.type-data-panel>.panel-heading{align-items:flex-start}.type-record-card .remove-button{margin-left:0;flex:none;padding:.38rem .6rem;font-size:.78rem}@media(max-width:760px){.type-record-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.type-record-wide{grid-column:span 2}.type-data-tools{justify-content:flex-start}}@media(max-width:520px){.type-record-fields{grid-template-columns:1fr}.type-record-wide{grid-column:span 1}.type-record-heading{align-items:flex-start;flex-wrap:wrap}.type-record-heading>strong{flex-basis:100%}.type-data-tools select{max-width:100%;width:100%}}
.index-taxon-row{display:flex;align-items:flex-start;gap:.6rem}.index-taxon-control{flex:1 1 0%;width:0;min-width:0}.index-taxon-row>.trash-button{position:relative;z-index:1;flex:0 0 30px;margin-left:.1rem}.index-taxon-control .selected-taxon{width:100%;min-width:0;box-sizing:border-box}.index-taxon-control .selected-taxon span{min-width:0}.index-taxon-control .taxon-search input{box-sizing:border-box;width:100%;min-width:0!important}
.specimen-summary-header,.specimen-summary{display:grid;grid-template-columns:minmax(150px,1.25fr) minmax(120px,.9fr) minmax(160px,1.2fr) minmax(110px,.75fr) 20px;gap:.8rem;align-items:center}
.specimen-summary-header{padding:0 .85rem;color:#657985;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
.type-record-card{padding:0;overflow:visible}
.specimen-summary{width:100%;min-width:0;padding:.9rem .85rem;border:0;border-radius:9px;background:transparent;color:#29434f;text-align:left;font:inherit;cursor:pointer}
.specimen-summary:hover{background:#f5f9fa}
.specimen-summary>span{min-width:0;overflow-wrap:anywhere}
.specimen-summary>span:first-child{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}
.specimen-summary small{display:block;color:#71848e;font-size:.75rem}
.specimen-summary>svg{display:none}
.new-species-badge{padding:.2rem .45rem;border-radius:999px;background:#fff3cf;color:#765e12!important;font-weight:800}
.type-record-fields{padding:1rem;border-top:1px solid #e3ebee;background:#fff}
.type-record-field select,.type-record-field textarea{width:100%;min-width:0;min-height:38px;box-sizing:border-box;padding:.48rem .6rem;border:1px solid #d2dde2;border-radius:6px;background:#fff;color:#29434f;font:inherit;font-size:.88rem}
.type-record-field textarea{resize:vertical}
.type-record-field small{color:#72838d;font-weight:400;line-height:1.4}
.specimen-autocomplete{position:relative;min-width:0}
.specimen-autocomplete input{box-sizing:border-box;width:100%;min-width:0!important}
.specimen-autocomplete .taxon-options{width:min(380px,75vw)}
.specimen-type-toggle .checkbox-control{display:flex;align-items:center;gap:.5rem;min-height:38px;color:#29434f;font-size:.88rem;font-weight:600}
.checkbox-control input{width:auto;min-height:0;margin:0;accent-color:#367f98}
.collector-chips{display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.25rem}
.collector-chip{display:inline-flex;align-items:center;gap:.3rem;padding:.25rem .45rem;border-radius:999px;background:#e8f3f5;color:#236b81;font-size:.78rem}
.collector-chip button{border:0;background:transparent;color:inherit;font-size:1rem;cursor:pointer}
.count-pair{display:flex;gap:.5rem}
.count-pair label{display:grid;flex:1;gap:.2rem;color:#72838d;font-size:.74rem}
.count-pair input{min-width:0}
.type-record-footer{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.7rem 1rem;border-top:1px solid #e3ebee;color:#72838d;font-size:.78rem}
@media(max-width:760px){.specimen-summary-header,.specimen-summary{grid-template-columns:minmax(130px,1.2fr) minmax(100px,.9fr) minmax(130px,1fr) 20px;gap:.55rem}.specimen-summary-header>span:nth-child(4),.specimen-summary>span:nth-child(4){display:none}.type-record-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.specimen-summary-header{display:none}.specimen-summary{grid-template-columns:minmax(0,1fr) 20px;gap:.4rem}.specimen-summary>span:nth-child(n+2){grid-column:1}.specimen-summary>span:nth-child(4){display:block}.specimen-summary>svg{display:block;grid-column:2;grid-row:1;justify-self:center;width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transform:rotate(-90deg);transition:transform .15s ease}.specimen-summary>svg.is-expanded{transform:rotate(0)}.specimen-summary>span:not(:first-child)::before{display:inline-block;margin-right:.35rem;color:#72838d;font-size:.7rem;font-weight:800;text-transform:uppercase}.specimen-summary>span:nth-child(2)::before{content:'Host:'}.specimen-summary>span:nth-child(3)::before{content:'Location:'}.specimen-summary>span:nth-child(4)::before{content:'Date:'}.type-record-fields{grid-template-columns:1fr}.type-record-wide{grid-column:span 1}.type-record-footer{align-items:flex-start;flex-direction:column}}
.reference-tools{display:flex;align-items:center;justify-content:flex-end;gap:.45rem;flex-wrap:wrap}
.reference-record-list{display:grid;gap:.65rem}
.reference-summary-header,.reference-summary{display:grid;grid-template-columns:minmax(220px,1.5fr) minmax(160px,1fr) 80px minmax(180px,1.1fr) 20px;gap:.8rem;align-items:center}
.reference-summary-header{padding:0 .85rem;color:#657985;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
.reference-record-card{overflow:hidden;border:1px solid #dbe5e9;border-radius:9px;background:#fbfcfd}
.reference-summary{width:100%;min-width:0;padding:.85rem;border:0;background:transparent;color:#29434f;text-align:left;font:inherit;cursor:pointer}
.reference-summary:hover{background:#f2f8fa}
.reference-summary>span{min-width:0;overflow-wrap:anywhere}
.reference-summary>span:first-child strong{display:block}
.reference-summary small{display:block;margin-top:.15rem;color:#72838d;font-size:.75rem}
.reference-summary>svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transform:rotate(-90deg);transition:transform .15s ease}
.reference-summary>svg.is-expanded{transform:rotate(0)}
.reference-fields-wrap{padding:1rem;border-top:1px solid #e3ebee;background:#fff}
.reference-match-tools{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-top:1rem}
.reference-match-status{margin-right:auto;color:#327990;font-size:.82rem;font-weight:700}
.reference-match-list{display:grid;gap:.45rem;margin:.75rem 0 0;padding:0;list-style:none}
.reference-match-list li{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.65rem .75rem;border:1px solid #dce5e9;border-radius:7px;background:#fbfcfd}
.reference-match-list li>div{min-width:0;display:grid;gap:.2rem}
.reference-match-list small{color:#72838d}
.reference-ocr-text{margin-top:.75rem;color:#536b77;font-size:.8rem}
.reference-ocr-text p{margin:.35rem 0 0;padding:.6rem;border-radius:6px;background:#f5f8f9;line-height:1.5}
.reference-record-footer{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-top:.9rem;padding-top:.75rem;border-top:1px solid #e7edef;color:#72838d;font-size:.76rem}
.bundle-download-panel{display:grid;grid-template-columns:minmax(220px,1fr) minmax(180px,.65fr) auto;align-items:end;gap:.8rem;margin-top:1.25rem;padding:1rem;border:1px solid #c9dbe1;border-radius:10px;background:#f4f9fa}
.bundle-download-panel h3{margin:0;color:#29434f;font-size:1rem}
.bundle-download-panel p{margin:.25rem 0 0;color:#657985;font-size:.82rem;line-height:1.45}
.pdf-export-name{display:grid;gap:.3rem;color:#526b76;font-size:.76rem;font-weight:700}
.pdf-export-name input{width:100%;min-height:38px;box-sizing:border-box;padding:.5rem .65rem;border:1px solid #d2dde2;border-radius:6px;background:#fff;color:#29434f;font:inherit;font-size:.88rem}
@media(max-width:900px){.reference-summary-header,.reference-summary{grid-template-columns:minmax(180px,1.3fr) minmax(130px,1fr) 65px 20px}.reference-summary-header>span:nth-child(4),.reference-summary>span:nth-child(4){display:none}.bundle-download-panel{grid-template-columns:1fr 1fr}.bundle-download-panel>div{grid-column:span 2}}
@media(max-width:560px){.reference-summary-header{display:none}.reference-summary{grid-template-columns:minmax(0,1fr) 20px;gap:.35rem}.reference-summary>span:nth-child(n+2){grid-column:1}.reference-summary>svg{grid-column:2;grid-row:1}.reference-match-list li{align-items:flex-start;flex-direction:column}.bundle-download-panel{grid-template-columns:1fr}.bundle-download-panel>div{grid-column:auto}.bundle-download-panel .primary-button{width:100%}.reference-record-footer{align-items:flex-start;flex-direction:column}}
.new-taxon-toggle{display:flex;align-items:center;gap:.35rem;flex:none;padding:.45rem .2rem;color:#526b76;font-size:.76rem;font-weight:700;white-space:nowrap;cursor:pointer}
.new-taxon-toggle input{width:auto;min-width:0;min-height:0;margin:0;padding:0;border:0;border-radius:0;background:transparent;accent-color:#367f98}
</style>
