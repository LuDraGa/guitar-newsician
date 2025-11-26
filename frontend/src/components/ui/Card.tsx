import { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  hover?: boolean
  glow?: boolean
}

export function Card({
  children,
  className,
  hover = false,
  glow = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-dark-300/50 p-6 backdrop-blur-sm',
        hover && 'transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl',
        glow && 'hover:shadow-brand-500/20',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <div className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  )
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode
}

export function CardTitle({ children, className, ...props }: CardTitleProps) {
  return (
    <h3
      className={cn('text-xl font-bold text-white', className)}
      {...props}
    >
      {children}
    </h3>
  )
}

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode
}

export function CardDescription({
  children,
  className,
  ...props
}: CardDescriptionProps) {
  return (
    <p className={cn('text-sm text-gray-400', className)} {...props}>
      {children}
    </p>
  )
}

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function CardContent({
  children,
  className,
  ...props
}: CardContentProps) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  )
}
