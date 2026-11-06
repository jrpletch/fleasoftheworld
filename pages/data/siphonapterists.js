// Curated content for the Siphonapterists page. Entries are keyed by the
// TaxonWorks person id. Everything else on the page comes from TaxonWorks.
//
//   ids      Optional. Extra TaxonWorks person ids for the same individual
//            (duplicate person records), merged into the same profile.
//   image    Optional. Path under public/, e.g. 'images/siphonapterists/smit.jpg'.
//            Overrides the image attached to the person as a depiction in TaxonWorks,
//            which is shown automatically when this is not set.
//   credit   Optional. Image credit shown under the photo.
//   article  Optional. Array of paragraphs (plain text). Overrides the person's
//            "Biography" data attribute in TaxonWorks, which is shown when not set.
export const featuredSiphonapterists = [
  { id: 309686, label: 'F.G.A.M. Smit' },
  { id: 60938, label: 'R. Traub' },
  { id: 35754, label: 'G.H.E. Hopkins' },
  { id: 136100, label: 'K. Jordan' }
]

export const siphonapteristProfiles = {
  309686: {},
  60938: {},
  35754: {}
}
