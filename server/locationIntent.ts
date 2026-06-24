const LOCATION_PATTERNS: RegExp[] = [
  /推荐\s*(.{2,24}?)\s*附近/u,
  /(?:想在|去)\s*(.{2,24}?)\s*(?:附近)?(?:吃|用餐)/u,
  /(.{2,24}?)\s*附近(?:的)?(?:吃|吃啥|推荐)?/u,
  /靠近\s*(.{2,24})/u,
]

const EXCLUDE_WORDS = /^(这|那|哪|什么|哪儿|哪里|附近|推荐|吃|的|了|个|家|好|不|要|想|去|我|你|他|她|它)/u

function cleanPlaceName(raw: string): string | null {
  let name = raw.trim().replace(/[，。！？、；："'""''\s]+$/u, '')
  name = name.replace(/^(的|在|到|去|吃)/u, '').trim()
  if (name.length < 2 || name.length > 24) return null
  if (EXCLUDE_WORDS.test(name)) return null
  if (/^(不吃|不要|别|安静|打包|停车|香菜)/u.test(name)) return null
  return name
}

export function parseLocationFromNotes(notes: string): { placeName: string } | null {
  const text = notes.trim()
  if (!text) return null

  for (const pattern of LOCATION_PATTERNS) {
    const match = text.match(pattern)
    if (!match?.[1]) continue
    const placeName = cleanPlaceName(match[1])
    if (placeName) return { placeName }
  }
  return null
}

export function stripLocationFromNotes(notes: string): string {
  let text = notes.trim()
  if (!text) return ''

  for (const pattern of LOCATION_PATTERNS) {
    text = text.replace(pattern, ' ').trim()
  }
  return text.replace(/\s+/g, ' ').trim()
}
