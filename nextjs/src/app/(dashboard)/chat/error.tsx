'use client'

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-lg font-semibold text-gray-900">Chat failed to load</h1>
      <p className="text-sm text-gray-600">{error.message || 'Something went wrong.'}</p>
      <button
        type="button"
        onClick={reset}
        className="text-sm font-medium text-primary-600 hover:underline"
      >
        Try again
      </button>
    </div>
  )
}
