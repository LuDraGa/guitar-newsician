import { useState, useCallback } from 'react'

export function useJobTracker() {
  const [activeJobs, setActiveJobs] = useState<string[]>([])

  const addJob = useCallback((jobId: string) => {
    setActiveJobs((prev) => [...prev, jobId])
  }, [])

  const removeJob = useCallback((jobId: string) => {
    setActiveJobs((prev) => prev.filter((id) => id !== jobId))
  }, [])

  return { activeJobs, addJob, removeJob }
}
