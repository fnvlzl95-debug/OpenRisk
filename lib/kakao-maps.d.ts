/**
 * Kakao Maps API 타입 정의
 */

export interface KakaoLatLng {
  getLat: () => number
  getLng: () => number
}

export interface KakaoMap {
  setCenter: (latlng: unknown) => void
  setLevel: (level: number) => void
  relayout: () => void
}

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void
        Map: new (container: HTMLElement, options: { center: unknown; level: number }) => KakaoMap
        LatLng: new (lat: number, lng: number) => KakaoLatLng
        Circle: new (options: {
          center: unknown
          radius: number
          strokeWeight: number
          strokeColor: string
          strokeOpacity: number
          strokeStyle: string
          fillColor: string
          fillOpacity: number
          map: KakaoMap
        }) => unknown
        CustomOverlay: new (options: {
          position: unknown
          content: string
          yAnchor: number
          map: KakaoMap
        }) => unknown
      }
    }
    Kakao: {
      init: (appKey: string) => void
      isInitialized: () => boolean
      Share: {
        sendDefault: (options: {
          objectType: string
          content: {
            title: string
            description: string
            imageUrl: string
            link: {
              mobileWebUrl: string
              webUrl: string
            }
          }
          buttons?: Array<{
            title: string
            link: {
              mobileWebUrl: string
              webUrl: string
            }
          }>
        }) => void
      }
    }
  }
}
