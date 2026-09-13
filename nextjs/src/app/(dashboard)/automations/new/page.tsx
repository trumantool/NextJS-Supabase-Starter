import Link from 'next/link'
import AutomationForm from '@/components/automations/AutomationForm'

export const metadata = {
  title: 'New Automation',
  description: 'Create a scheduled OpenRouter job.',
}

export default function NewAutomationPage() {
  return (
    <div className="w-[95%] mx-auto px-4 py-8">
      <Link href="/automations" className="text-sm text-blue-600 hover:underline">
        ← Automations
      </Link>
      <h1 className="text-3xl font-bold mt-3 mb-2">New Automation</h1>
      <p className="text-gray-600 mb-8">
        Describe a job once. The assistant runs it on a schedule with OpenRouter and any attached
        skills.
      </p>
      <div className="border border-gray-200 rounded-lg p-6 bg-white">
        <AutomationForm mode="create" />
      </div>
    </div>
  )
}
