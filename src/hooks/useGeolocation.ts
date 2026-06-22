import { useCallback, useState } from 'react'

interface GeolocationState {
  lat: number | null
  lng: number | null
  loading: boolean
  error: string | null
  source: 'gps' | 'network' | 'ip' | null
}

function getPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

function getErrorMessage(code: number): string {
  const messages: Record<number, string> = {
    1: '定位被拒绝。请在浏览器或系统设置中允许此网站使用位置',
    2: '无法获取位置。可尝试开启 Wi-Fi，或使用下方的「网络定位」',
    3: '定位超时。室内或 Mac 上较常见，请用「网络定位」或重试',
  }
  return messages[code] || '定位失败，请重试'
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lng: null,
    loading: false,
    error: null,
    source: null,
  })

  const setLocation = useCallback((lat: number, lng: number, source: GeolocationState['source'] = 'ip') => {
    setState({
      lat,
      lng,
      loading: false,
      error: null,
      source,
    })
  }, [])

  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: '你的浏览器不支持定位', loading: false }))
      return
    }

    if (!window.isSecureContext) {
      setState((s) => ({
        ...s,
        error: '当前为非安全连接（非 localhost/https），浏览器无法定位。请用 localhost 访问，或点「网络定位」',
        loading: false,
      }))
      return
    }

    setState((s) => ({ ...s, loading: true, error: null }))

    try {
      // 先用低精度（Wi-Fi/基站），Mac 室内通常几秒内能返回
      const position = await getPosition({
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 300000,
      })

      setState({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        loading: false,
        error: null,
        source: 'network',
      })
    } catch (firstError) {
      try {
        // 低精度失败再试高精度
        const position = await getPosition({
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        })

        setState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          loading: false,
          error: null,
          source: 'gps',
        })
      } catch (secondError) {
        const err = secondError as GeolocationPositionError
        setState({
          lat: null,
          lng: null,
          loading: false,
          error: getErrorMessage(err.code),
          source: null,
        })
      }
    }
  }, [])

  return { ...state, requestLocation, setLocation }
}
