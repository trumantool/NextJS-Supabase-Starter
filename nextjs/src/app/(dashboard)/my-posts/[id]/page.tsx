import { PostEditor } from '@/components/posts/PostEditor'

export const metadata = {
  title: 'Edit post',
}

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const backHref = from === 'admin' ? '/admin/blog' : '/my-posts'
  return <PostEditor mode="edit" postId={id} backHref={backHref} />
}
