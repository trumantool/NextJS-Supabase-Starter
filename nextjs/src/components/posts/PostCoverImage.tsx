import Image from 'next/image'
import { isOptimizableCover } from '@/lib/blog-roll'

/** 16:9 cover. Supabase and local paths use next/image; any other https URL uses img. */
export function PostCoverImage({
  src,
  alt,
  priority = false,
}: {
  src: string
  alt: string
  priority?: boolean
}) {
  if (isOptimizableCover(src)) {
    return (
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className="object-cover"
          sizes="(min-width: 768px) 720px, 100vw"
        />
      </div>
    )
  }
  return (
    // Authors can store any https cover. next/image only allows the public storage host.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="aspect-video w-full object-cover" />
  )
}
