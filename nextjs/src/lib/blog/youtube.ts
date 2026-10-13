const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/** Accept a raw id or a YouTube / nocookie URL. Anything else is ignored. */
export function youtubeVideoId(input: string | null | undefined): string | null {
  const trimmed = input?.trim() ?? ''
  if (!trimmed) return null
  if (VIDEO_ID.test(trimmed)) return trimmed
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? ''
    return VIDEO_ID.test(id) ? id : null
  }
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null
  if (url.pathname === '/watch') {
    const id = url.searchParams.get('v') ?? ''
    return VIDEO_ID.test(id) ? id : null
  }
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
    const id = parts[1] ?? ''
    return VIDEO_ID.test(id) ? id : null
  }
  return null
}

export function youtubeNocookieSrc(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`
}
