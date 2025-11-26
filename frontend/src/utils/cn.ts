import { clsx, type ClassValue } from 'clsx'

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx for conditional classes with deduplication
 *
 * @example
 * cn('px-2 py-1', someCondition && 'bg-blue-500')
 * cn('px-2', 'px-4') // 'px-4' (later classes override)
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
