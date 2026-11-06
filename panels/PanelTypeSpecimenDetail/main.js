import PanelTypeSpecimenDetail from './PanelTypeSpecimenDetail.vue'
import { SPECIES_GROUP, SPECIES_AND_INFRASPECIES_GROUP } from '@/modules/otus/constants'

export default {
  id: 'panel:type-specimen-detail',
  component: PanelTypeSpecimenDetail,
  rankGroup: [SPECIES_GROUP, SPECIES_AND_INFRASPECIES_GROUP]
}
