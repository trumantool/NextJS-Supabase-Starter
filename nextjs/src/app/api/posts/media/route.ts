import { NextResponse, type NextRequest } from 'next/server'
import { assertBlogMedia, blogMediaObjectPath, httpStatusForPostError, requirePostWebsite } from '@/lib/posts'
import { createSSRClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Cover image must be a file' }, { status: 400 })
    }

    const mime = file.type
    const ext = assertBlogMedia(mime, file.size)
    const website = requirePostWebsite(process.env.POSTS_WEBSITE)
    const id = crypto.randomUUID()
    const path = blogMediaObjectPath(website, user.id, id, ext)
    const bytes = Buffer.from(await file.arrayBuffer())

    const uploaded = await supabase.storage.from('blog-media').upload(path, bytes, {
      contentType: mime,
      upsert: false,
    })
    if (uploaded.error) throw new Error(uploaded.error.message)

    const { data: publicUrl } = supabase.storage.from('blog-media').getPublicUrl(path)
    const { error } = await supabase.from('blog_media').insert({
      website,
      owner_id: user.id,
      path,
      public_url: publicUrl.publicUrl,
      mime,
      byte_size: file.size,
    })
    if (error) throw new Error(error.message)

    return NextResponse.json({ url: publicUrl.publicUrl, path })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upload image'
    console.error('Blog media POST error:', err)
    return NextResponse.json({ error: message }, { status: httpStatusForPostError(message) })
  }
}
