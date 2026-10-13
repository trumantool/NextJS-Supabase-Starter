import { authorByline } from '@/lib/blog-roll'

function visible(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length > 0 ? trimmed : null
}

export function AuthorHeading({
  displayName,
  title,
  company,
  location,
  bio,
  linkedin,
}: {
  displayName: string
  title: string | null
  company: string | null
  location: string | null
  bio: string | null
  linkedin?: string
}) {
  const role = authorByline(title, company)
  const place = visible(location)
  return (
    <>
      <h1 className="text-4xl font-bold text-gray-900">{displayName}</h1>
      {role ? <p className="mt-2 text-lg text-gray-800">{role}</p> : null}
      {place ? <p className="mt-1 text-gray-600">{place}</p> : null}
      {bio ? <p className="mt-3 text-lg text-gray-600">{bio}</p> : null}
      {linkedin ? (
        <p className="mt-3">
          <a href={linkedin} rel="me noopener noreferrer" className="text-primary-700 hover:underline">
            LinkedIn
          </a>
        </p>
      ) : null}
    </>
  )
}
