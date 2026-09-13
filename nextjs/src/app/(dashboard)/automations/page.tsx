import AutomationList from '@/components/automations/AutomationList'

export const metadata = {
  title: 'Automations',
  description: 'Schedule OpenRouter jobs with skills and inspect run history.',
}

export default function AutomationsPage() {
  return <AutomationList />
}
