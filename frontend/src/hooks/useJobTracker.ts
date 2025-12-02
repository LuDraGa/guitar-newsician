import { useState, useCallback } from 'react'

export interface JobHistoryEntry {
  jobId: string
  jobType?: string
  songName?: string
  actionName?: string
  state: 'completed' | 'failed' | 'dismissed'
  timestamp: number
  error?: string
}

export function useJobTracker() {
  const [activeJobs, setActiveJobs] = useState<string[]>([])
  const [dismissedJobs, setDismissedJobs] = useState<Set<string>>(new Set())
  const [jobHistory, setJobHistory] = useState<JobHistoryEntry[]>([])

  const addJob = useCallback((jobId: string) => {
    setActiveJobs((prev) => {
      // Don't add if already active or dismissed
      if (prev.includes(jobId) || dismissedJobs.has(jobId)) {
        return prev
      }
      return [...prev, jobId]
    })
  }, [dismissedJobs])

  const removeJob = useCallback((jobId: string) => {
    setActiveJobs((prev) => prev.filter((id) => id !== jobId))
  }, [])

  const dismissJob = useCallback((jobId: string, songName?: string, actionName?: string) => {
    // Remove from active jobs
    setActiveJobs((prev) => prev.filter((id) => id !== jobId))

    // Add to dismissed set
    setDismissedJobs((prev) => new Set(prev).add(jobId))

    // Add to history
    setJobHistory((prev) => [
      {
        jobId,
        songName,
        actionName,
        state: 'dismissed',
        timestamp: Date.now(),
      },
      ...prev.slice(0, 49), // Keep last 50 entries
    ])
  }, [])

  const completeJob = useCallback((jobId: string, jobType?: string, songName?: string, actionName?: string) => {
    // Remove from active jobs
    setActiveJobs((prev) => prev.filter((id) => id !== jobId))

    // Add to history
    setJobHistory((prev) => [
      {
        jobId,
        jobType,
        songName,
        actionName,
        state: 'completed',
        timestamp: Date.now(),
      },
      ...prev.slice(0, 49), // Keep last 50 entries
    ])
  }, [])

  const failJob = useCallback((jobId: string, jobType?: string, error?: string, songName?: string, actionName?: string) => {
    // Remove from active jobs
    setActiveJobs((prev) => prev.filter((id) => id !== jobId))

    // Add to history
    setJobHistory((prev) => [
      {
        jobId,
        jobType,
        songName,
        actionName,
        state: 'failed',
        error,
        timestamp: Date.now(),
      },
      ...prev.slice(0, 49), // Keep last 50 entries
    ])
  }, [])

  const clearHistory = useCallback(() => {
    setJobHistory([])
    setDismissedJobs(new Set())
  }, [])

  return {
    activeJobs,
    jobHistory,
    addJob,
    removeJob,
    dismissJob,
    completeJob,
    failJob,
    clearHistory,
  }
}
