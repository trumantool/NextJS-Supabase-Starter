import AgentTemplateCatalog from '@/components/agents/AgentTemplateCatalog'

export const metadata = {
  title: 'Agent Templates',
  description: 'Browse published agent templates and clone one into your account.',
}

export default function Page() {
  return <AgentTemplateCatalog />
}
