import { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils'

interface BentoCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  size?: '1x1' | '2x1' | '1x2' | '2x2'
}

export function BentoCard({
  children,
  className,
  size = '1x1',
  ...props
}: BentoCardProps) {
  const sizeClasses = {
    '1x1': 'col-span-1 row-span-1',
    '2x1': 'col-span-1 md:col-span-2 row-span-1',
    '1x2': 'col-span-1 row-span-1 md:row-span-2',
    '2x2': 'col-span-1 md:col-span-2 row-span-1 md:row-span-2',
  }

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-8 backdrop-blur-sm transition-all duration-500 hover:border-white/[0.15]',
        'shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] hover:shadow-[0_12px_48px_0_rgba(0,0,0,0.6)]',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-[0.02]" />

      {children}
    </div>
  )
}
