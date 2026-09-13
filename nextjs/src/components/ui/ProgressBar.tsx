interface ProgressBarProps {
  value: number // 0–100
  minWidth?: number // optional minimum width %, default 0
  className?: string
}

export function ProgressBar({ value, minWidth = 0, className = '' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={`mt-2 h-2 bg-gray-200 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-primary-600 transition-all duration-300"
        style={{ width: `${clamped}%`, minWidth: `${minWidth}%` }}
      />
    </div>
  )
}