import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createWorker } from 'tesseract.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const COUNTRY_CODES = new Set([
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
    .flatMap((a) => Array.from({ length: 26 }, (_, i) => `${a}${String.fromCharCode(65 + i)}`))
    .filter((code) => new Intl.DisplayNames(['en'], { type: 'region' }).of(code) !== code)
])
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

export async function readPdf(file) {
  const data = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer())
  const wasmUrl = new URL(`${import.meta.env.BASE_URL}pdfjs/wasm/`, globalThis.location.href).href
  const standardFontDataUrl = new URL(`${import.meta.env.BASE_URL}pdfjs/standard_fonts/`, globalThis.location.href).href
  const loadingTask = pdfjsLib.getDocument({ data, wasmUrl, standardFontDataUrl })
  const pdf = await loadingTask.promise
  const pages = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const rows = new Map()
    for (const item of content.items) {
      if (!item.str?.trim()) continue
      const y = Math.round(item.transform?.[5] || 0)
      rows.set(y, [...(rows.get(y) || []), item.str.trim()])
    }
    const text = [...rows.entries()]
      .sort(([a], [b]) => b - a)
      .map(([, words]) => words.join(' '))
      .join('\n')
    pages.push({ pageNumber, text, textItems: content.items, hasText: text.trim().length > 20 })
  }
  return { pdf, pages, loadingTask }
}

export async function ocrPages(pdf, pageNumbers, onProgress = () => {}) {
  const worker = await createWorker('eng', 1, {
    logger: (message) => onProgress(message)
  })
  const results = new Map()
  try {
    for (let index = 0; index < pageNumbers.length; index += 1) {
      const pageNumber = pageNumbers[index]
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.8 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
      const { data } = await worker.recognize(canvas)
      results.set(pageNumber, {
        text: data.text || '',
        words: (data.words || []).map((word) => ({ text: word.text, bbox: word.bbox })),
        width: canvas.width,
        height: canvas.height
      })
      canvas.width = 0
      canvas.height = 0
      onProgress({ status: 'recognizing text', progress: (index + 1) / pageNumbers.length })
    }
  } finally {
    await worker.terminate()
  }
  return results
}

const contextWordsAfterTaxon = new Set([
  'a', 'about', 'above', 'after', 'again', 'all', 'also', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'before',
  'being', 'below', 'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'during', 'each', 'for',
  'from', 'had', 'has', 'have', 'he', 'her', 'here', 'hers', 'him', 'his', 'how', 'if', 'in', 'into', 'is', 'it',
  'its', 'may', 'might', 'more', 'most', 'must', 'near', 'no', 'not', 'of', 'off', 'on', 'once', 'only', 'or',
  'other', 'our', 'out', 'over', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
  'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'under', 'until', 'up', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'while', 'who', 'will', 'with', 'would', 'you', 'your', 'found',
  'collected', 'recorded', 'reported', 'described', 'occurs', 'occurring', 'known', 'present'
])

function nameTokens(value) {
  return [...String(value || '').matchAll(/[\p{L}\p{N}]+\.?/gu)].map((match) => ({
    text: match[0],
    normalized: match[0].replace(/\.$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(),
    end: match.index + match[0].length
  }))
}

function trimContextAfterTaxon(value) {
  const text = String(value || '').trim()
  const tokens = nameTokens(text)
  const contextIndex = tokens.findIndex((token, index) => index > 0 && contextWordsAfterTaxon.has(token.normalized))
  return contextIndex > 0 ? text.slice(0, tokens[contextIndex - 1].end).trim().replace(/[\s,;:]+$/, '') : text
}

function cleanTaxonMention(verbatim, canonical) {
  const surface = trimContextAfterTaxon(verbatim)
  const cleanedCanonical = trimContextAfterTaxon(canonical)
  const surfaceTokens = nameTokens(surface)
  const canonicalTokens = nameTokens(cleanedCanonical)
  if (!surfaceTokens.length || !canonicalTokens.length) return surface || cleanedCanonical

  let matched = 0
  for (let index = 0; index < canonicalTokens.length && index < surfaceTokens.length; index += 1) {
    const expected = canonicalTokens[index].normalized
    const actual = surfaceTokens[index].normalized
    const genusAbbreviation = index === 0 && actual.length === 1 && expected.startsWith(actual)
    if (actual !== expected && !genusAbbreviation) break
    matched += 1
  }
  if (matched === canonicalTokens.length) return surface.slice(0, surfaceTokens[matched - 1].end).trim().replace(/[\s,;:]+$/, '')
  return surface || cleanedCanonical
}

export async function findNames(text) {
  const body = new FormData()
  body.append('file', new File([text], 'document.txt', { type: 'text/plain' }))
  body.append('verification', 'true')
  const response = await fetch('https://finder.globalnames.org/api/v1/find', { method: 'POST', body })
  if (!response.ok) throw new Error(`GNFinder returned HTTP ${response.status}`)
  const result = await response.json()
  return (result.names || []).map((name, index) => {
    const verbatim = name.verbatim || name.name || name.canonical || ''
    const canonical = name.canonicalName || name.canonical || name.name || ''
    const cleanName = cleanTaxonMention(verbatim, canonical)
    return {
    id: `name-${index}`,
    name: cleanName,
    canonical: cleanTaxonMention(canonical, canonical),
    start: name.start != null && Number.isFinite(Number(name.start)) ? Number(name.start) : null,
    end: name.end != null && Number.isFinite(Number(name.end)) ? Number(name.end) : null,
    cardinality: Number(name.cardinality) || 1,
    evidence: verbatim
  }
  }).filter((name) => name.name)
}

function normalizeName(value) {
  return String(value || '').normalize('NFKD').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

export function nameHighlightRects(textItems, viewport, name, occurrence = 0) {
  const normalizedName = normalizeName(name)
  if (!normalizedName) return []
  let normalizedPageText = ''
  const charItems = []
  textItems.forEach((item, itemIndex) => {
    const normalizedItem = normalizeName(item.str)
    for (const character of normalizedItem) {
      normalizedPageText += character
      charItems.push(itemIndex)
    }
  })
  const hits = []
  let from = 0
  while (from <= normalizedPageText.length - normalizedName.length) {
    const index = normalizedPageText.indexOf(normalizedName, from)
    if (index < 0) break
    hits.push(index)
    from = index + normalizedName.length
  }
  if (!hits.length) return []
  const selectedHits = occurrence == null ? hits : [hits[Math.min(occurrence, hits.length - 1)]]
  const matchedItems = new Set(selectedHits.flatMap((selectedHit) => charItems.slice(selectedHit, selectedHit + normalizedName.length)))
  return [...matchedItems].map((index) => {
    const item = textItems[index]
    const transform = pdfjsLib.Util.transform(viewport.transform, item.transform)
    const height = Math.hypot(transform[2], transform[3])
    return {
      left: transform[4],
      top: transform[5] - height,
      width: Math.max(2, item.width * viewport.scale),
      height: Math.max(2, height)
    }
  })
}

export function ocrNameHighlightRects(words, imageWidth, imageHeight, viewport, name, occurrence = 0) {
  const normalizedName = normalizeName(name)
  if (!normalizedName || !words?.length || !imageWidth || !imageHeight) return []
  const normalizedWords = words.map((word, index) => ({ word, index, text: normalizeName(word.text) })).filter((entry) => entry.text)
  const flat = normalizedWords.map((entry) => entry.text).join('')
  const charWords = normalizedWords.flatMap((entry) => Array.from(entry.text, () => entry.index))
  const hits = []
  let from = 0
  while (from <= flat.length - normalizedName.length) {
    const index = flat.indexOf(normalizedName, from)
    if (index < 0) break
    hits.push(index)
    from = index + normalizedName.length
  }
  let matchedWords
  if (hits.length) {
    const selectedHits = occurrence == null ? hits : [hits[Math.min(occurrence, hits.length - 1)]]
    matchedWords = new Set(selectedHits.flatMap((selectedHit) => charWords.slice(selectedHit, selectedHit + normalizedName.length)))
  } else if (occurrence == null) {
    // Search strings come from OCR text, while Tesseract's word boxes can
    // differ slightly in punctuation, line order, or a misread character.
    // Mark the recognizable words in sequence so the searched phrase still
    // has a visible location on the page.
    const queryWords = String(name).match(/[\p{L}\p{N}]+/gu)?.map(normalizeName).filter((word) => word.length >= 4) || []
    if (queryWords.length < 2) return []
    const distanceAtMostOne = (left, right) => {
      if (left === right) return true
      if (Math.abs(left.length - right.length) > 1 || Math.min(left.length, right.length) < 5) return false
      let leftIndex = 0
      let rightIndex = 0
      let edits = 0
      while (leftIndex < left.length && rightIndex < right.length) {
        if (left[leftIndex] === right[rightIndex]) {
          leftIndex += 1
          rightIndex += 1
        } else {
          edits += 1
          if (edits > 1) return false
          if (left.length >= right.length) leftIndex += 1
          if (right.length >= left.length) rightIndex += 1
        }
      }
      return edits + (left.length - leftIndex) + (right.length - rightIndex) <= 1
    }
    matchedWords = new Set()
    let cursor = 0
    for (const queryWord of queryWords) {
      const end = Math.min(normalizedWords.length, cursor + 32)
      let found = normalizedWords.findIndex((entry, index) => index >= cursor && index < end && entry.text === queryWord)
      if (found < 0) found = normalizedWords.findIndex((entry, index) => index >= cursor && index < end && distanceAtMostOne(queryWord, entry.text))
      if (found >= 0) {
        matchedWords.add(normalizedWords[found].index)
        cursor = found + 1
      }
    }
    if (matchedWords.size < Math.min(2, queryWords.length)) return []
  } else {
    return []
  }
  const scaleX = viewport.width / imageWidth
  const scaleY = viewport.height / imageHeight
  return [...matchedWords].map((index) => {
    const { x0, y0, x1, y1 } = words[index].bbox
    return { left: x0 * scaleX, top: y0 * scaleY, width: (x1 - x0) * scaleX, height: (y1 - y0) * scaleY }
  })
}

function countryMatches(line) {
  const hits = new Set()
  for (const code of COUNTRY_CODES) {
    const country = regionNames.of(code)
    if (country && country.length > 2 && new RegExp(`\\b${country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(line)) hits.add(country)
  }
  const aliases = [
    [/\bUSA\b|\bUnited States\b/i, 'United States'], [/\bUK\b|\bUnited Kingdom\b/i, 'United Kingdom'],
    [/\bCongo\b/i, 'Congo'], [/\bIvory Coast\b/i, 'Ivory Coast'], [/\bBurma\b/i, 'Myanmar'],
    [/\bSiam\b/i, 'Thailand'], [/\bPersia\b/i, 'Iran'], [/\bCzechoslovakia\b/i, 'Czechia']
  ]
  aliases.forEach(([pattern, country]) => { if (pattern.test(line)) hits.add(country) })
  return [...hits]
}

export function extractCandidates(pages) {
  const candidates = []
  let inReferences = false
  for (const page of pages) {
    for (const rawLine of page.text.split(/\n+/)) {
      const line = rawLine.trim()
      if (line.length < 15) continue
      if (/^(references|literature cited|bibliography|literature)\s*$/i.test(line)) {
        inReferences = true
        continue
      }
      if (/^(index|acknowledg(?:e)?ments|appendix)\s*$/i.test(line)) inReferences = false
      const add = (type, value = line) => candidates.push({
        id: `candidate-${candidates.length}`, type, page: page.pageNumber, value, evidence: line
      })
      if (/specimens? examined|material examined|material studied|examined material|specimens? collected/i.test(line)) add('Specimen record')
      if (/host|associated with|host association|from (?:the )?(?:nest|burrow|body|fur)/i.test(line)) add('Host association')
      const countries = countryMatches(line)
      if (countries.length && /distribution|locality|collected|recorded|found|from|country|province|district|near|at\b/i.test(line)) {
        add('Country distribution', countries.join('; '))
      }
      if (inReferences && /\b(?:19|20)\d{2}\b/.test(line)) add('Cited reference')
    }
  }
  return candidates
}
