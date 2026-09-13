import { getMyAssessments } from '@/app/(dashboard)/my-assessments/actions'
import { MyAssessments } from '@/components/MyAssessments'

export const dynamic = 'force-dynamic'

export default async function MyAssessmentsPage() {
  const assessments = await getMyAssessments()

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <MyAssessments assessments={assessments} />
    </div>
  )
}
