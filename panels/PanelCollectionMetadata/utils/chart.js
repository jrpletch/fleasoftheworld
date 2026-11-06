export const TW_COLOR = 'rgb(0,59,230)'
export const GBIF_COLOR = 'rgb(0,103,25)'
export const HEAT_COLOR = '213,94,0'

export const MONTH_LABELS = [
  'J',
  'F',
  'M',
  'A',
  'M',
  'J',
  'J',
  'A',
  'S',
  'O',
  'N',
  'D'
]

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

export function niceTicks(max, count = 4) {
  const rough = max / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step =
    [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ||
    magnitude * 10
  const ticks = []
  for (let v = 0; ; v += step) {
    ticks.push(Math.round(v))
    if (v >= max) break
  }
  return ticks
}
