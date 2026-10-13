import { Node, mergeAttributes } from '@tiptap/core'
import { documentExtensions } from '@/app/(dashboard)/documents/lib/editor-schema'
import { youtubeNocookieSrc, youtubeVideoId } from '@/lib/blog/youtube'

export const Youtube = Node.create({
  name: 'youtube',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      videoId: {
        default: null,
        parseHTML: (element) => youtubeVideoId(element.getAttribute('data-video-id') ?? element.getAttribute('src')),
        renderHTML: (attributes) => {
          const id = youtubeVideoId(typeof attributes.videoId === 'string' ? attributes.videoId : '')
          return id ? { 'data-video-id': id } : {}
        },
      },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-video]',
      },
      {
        tag: 'iframe[src]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false
          const src = element.getAttribute('src') ?? ''
          const videoId = youtubeVideoId(src)
          return videoId ? { videoId } : false
        },
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    const id = youtubeVideoId(typeof HTMLAttributes.videoId === 'string' ? HTMLAttributes.videoId : '')
    if (!id) return ['div', { 'data-youtube-video': '' }]
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-youtube-video': '',
        'data-video-id': id,
        class: 'my-4 aspect-video w-full max-w-full overflow-hidden',
      }),
      [
        'iframe',
        {
          src: youtubeNocookieSrc(id),
          title: 'YouTube video',
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          allowfullscreen: 'true',
          loading: 'lazy',
          class: 'h-full w-full max-w-full',
        },
      ],
    ]
  },
})

/** Document schema plus the blog YouTube embed. Documents themselves stay unchanged. */
export const blogExtensions = [...documentExtensions, Youtube]
