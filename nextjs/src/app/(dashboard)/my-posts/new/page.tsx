import { PostEditor } from '@/components/posts/PostEditor'

export const metadata = {
  title: 'New post',
}

export default function NewPostPage() {
  return <PostEditor mode="new" />
}
