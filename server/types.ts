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

export interface RecommendRequest {
  mood: string[]
  tastes: string[]
  cuisines: string[]
  budget?: string
  otherNotes?: string
  historyHint?: string
  excludeNames?: string[]
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
}
