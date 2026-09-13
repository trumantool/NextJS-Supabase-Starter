import AgentEditor from '@/components/agents/AgentEditor'

export const metadata = {
  title: 'Edit agent',
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AgentEditor agentId={id} />
}
