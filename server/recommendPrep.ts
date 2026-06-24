import {
  fetchNearbyRestaurants,
  geocodePlace,
  getMockRestaurants,
  withDistancesFromPoint,
} from './amap.js'
import { parseLocationFromNotes, stripLocationFromNotes } from './locationIntent.js'
import type { RecommendRequest } from './types.js'

export const ANCHOR_RADIUS_M = 3000

export async function prepareRecommendRequest(
  body: RecommendRequest,
  options: {
    amapKey?: string
    mockMode: boolean
    userLat?: number
    userLng?: number
  },
): Promise<{
  req: RecommendRequest
  locationAnchor?: { name: string }
  locationAnchorFailed?: boolean
}> {
  const parsed = body.otherNotes ? parseLocationFromNotes(body.otherNotes) : null
  if (!parsed) {
    return { req: body }
  }

  let locationAnchor: RecommendRequest['locationAnchor']
  const cityHint = body.locationCity

  if (options.mockMode) {
    const baseLat = options.userLat ?? 39.9042
    const baseLng = options.userLng ?? 116.4074
    locationAnchor = {
      name: parsed.placeName,
      lat: baseLat + 0.008,
      lng: baseLng + 0.008,
    }
  } else if (options.amapKey) {
    const geo = await geocodePlace(parsed.placeName, options.amapKey, cityHint)
    if (geo) {
      locationAnchor = { name: parsed.placeName, lat: geo.lat, lng: geo.lng }
    }
  }

  if (!locationAnchor) {
    return { req: body, locationAnchorFailed: true }
  }

  let restaurants = body.restaurants
  if (options.mockMode) {
    restaurants = getMockRestaurants(locationAnchor.lat, locationAnchor.lng)
  } else if (options.amapKey) {
    const { restaurants: fetched } = await fetchNearbyRestaurants(
      locationAnchor.lat,
      locationAnchor.lng,
      4000,
      options.amapKey,
    )
    restaurants = fetched
  }

  restaurants = withDistancesFromPoint(restaurants, locationAnchor.lat, locationAnchor.lng).filter(
    (r) => r.distance <= ANCHOR_RADIUS_M,
  )

  const cleanedNotes = stripLocationFromNotes(body.otherNotes!) || undefined

  return {
    req: {
      ...body,
      restaurants,
      otherNotes: cleanedNotes,
      locationAnchor,
    },
    locationAnchor: { name: locationAnchor.name },
  }
}
