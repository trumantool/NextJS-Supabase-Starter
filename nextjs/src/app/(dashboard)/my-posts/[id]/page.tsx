import { PostEditor } from '@/components/posts/PostEditor'

export const metadata = {
  title: 'Edit post',
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PostEditor mode="edit" postId={id} />
}
