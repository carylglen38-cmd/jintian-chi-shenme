export interface Restaurant {
  id: string
  name: string
  type: string
  address: string
  distance: number
  distanceText: string
  location: string
  tel?: string
}

export interface LocationAnchor {
  name: string
  lat: number
  lng: number
}

export interface RecommendRequest {
  mood: string[]
  tastes: string[]
  cuisines: string[]
  diningStyle?: string
  budget?: string
  otherNotes?: string
  historyHint?: string
  locationCity?: string
  userLat?: number
  userLng?: number
  locationAnchor?: LocationAnchor
  excludeNames?: string[]
  cooldownNames?: string[]
  restaurants: Restaurant[]
}

export interface Recommendation {
  name: string
  reason: string
  score: number
}

export interface RecommendResponse {
  recommendations: Recommendation[]
  usedMock?: boolean
  fallbackReason?: string
  locationAnchor?: { name: string }
  locationAnchorFailed?: boolean
}
