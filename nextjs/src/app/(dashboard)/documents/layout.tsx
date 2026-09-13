// Documents — route layout.
// The parent dashboard layout already wraps routes in AppLayout (sidebar + header),
// so this layout is a pass-through to avoid rendering a duplicate header/sidebar.
export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
