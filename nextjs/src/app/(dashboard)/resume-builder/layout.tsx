// Resume Builder — route layout.
// The parent app/layout.tsx already wraps routes in AppLayout (sidebar + header),
// so this layout is a pass-through to avoid rendering a duplicate header/sidebar.
export default function ResumeBuilderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}