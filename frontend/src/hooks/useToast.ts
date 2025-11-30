import { useState, useCallback } from 'react'
import { Toast, ToastType } from '@/components/ui/Toast'

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, title: string, message?: string, duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    const toast: Toast = { id, type, title, message, duration }
    setToasts((prev) => [...prev, toast])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const info = useCallback(
    (title: string, message?: string, duration?: number) => addToast('info', title, message, duration),
    [addToast]
  )

  const success = useCallback(
    (title: string, message?: string, duration?: number) => addToast('success', title, message, duration),
    [addToast]
  )

  const error = useCallback(
    (title: string, message?: string, duration?: number) => addToast('error', title, message, duration),
    [addToast]
  )

  const warning = useCallback(
    (title: string, message?: string, duration?: number) => addToast('warning', title, message, duration),
    [addToast]
  )

  return {
    toasts,
    addToast,
    removeToast,
    info,
    success,
    error,
    warning,
  }
}
