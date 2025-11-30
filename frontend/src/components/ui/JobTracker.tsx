import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/utils'
import { jobsApi } from '@/services/api'

interface Job {
  job_id: string
  job_type?: string
  state?: 'queued' | 'running' | 'completed' | 'failed'
  progress?: number
  message?: string
  error?: string | null
}

interface JobTrackerProps {
  jobId: string
  onComplete?: (job: Job) => void
  onError?: (job: Job) => void
  className?: string
}

export function JobTracker({ jobId, onComplete, onError, className }: JobTrackerProps) {
  const [job, setJob] = useState<Job | null>(null)
  const [expanded, setExpanded] = useState(true)

  const pollJob = useCallback(async () => {
    try {
      const data = await jobsApi.getJob(jobId)
      setJob(data)

      if (data.state === 'completed') {
        onComplete?.(data)
      } else if (data.state === 'failed') {
        onError?.(data)
      }
    } catch (error) {
      console.error('[JobTracker] Failed to fetch job:', error)
    }
  }, [jobId, onComplete, onError])

  useEffect(() => {
    // Initial fetch
    pollJob()

    // Poll every 2 seconds if not complete
    const interval = setInterval(() => {
      if (job?.state === 'completed' || job?.state === 'failed') {
        clearInterval(interval)
      } else {
        pollJob()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [pollJob, job?.state])

  if (!job) {
    return (
      <div className={cn('rounded-lg border border-white/10 bg-dark-300/50 p-3', className)}>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          <span className="font-mono text-xs text-gray-400">Loading job...</span>
        </div>
      </div>
    )
  }

  const stateStyles = {
    queued: 'border-blue-500/30 bg-blue-500/10',
    running: 'border-accent-500/30 bg-accent-500/10',
    completed: 'border-green-500/30 bg-green-500/10',
    failed: 'border-red-500/30 bg-red-500/10',
  }

  const stateIcons = {
    queued: (
      <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    running: (
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
    ),
    completed: (
      <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    failed: (
      <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }

  const state = job.state || 'queued'

  return (
    <div className={cn('rounded-lg border p-3', stateStyles[state], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 items-start gap-2">
          <div className="flex-shrink-0 pt-0.5">{stateIcons[state]}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-sans text-sm font-semibold capitalize text-white">
                {job.job_type?.replace('_', ' ') || 'Job'}
              </span>
              <span className="font-mono text-xs text-gray-400">#{job.job_id?.slice(-6) || 'unknown'}</span>
            </div>
            {job.message && <p className="mt-1 font-mono text-xs text-gray-300">{job.message}</p>}

            {/* Progress bar for running jobs */}
            {state === 'running' && job.progress !== undefined && (
              <div className="mt-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-accent-500 transition-all duration-300"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <p className="mt-1 font-mono text-xs text-gray-400">{Math.round(job.progress)}%</p>
              </div>
            )}

            {/* Error message */}
            {job.error && (
              <div className="mt-2 rounded bg-red-900/20 p-2">
                <p className="font-mono text-xs text-red-300">{job.error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Expand/collapse button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0 text-gray-400 transition-colors hover:text-white"
        >
          <svg
            className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
          <div className="font-mono text-xs text-gray-400">
            <span className="text-gray-500">State:</span>{' '}
            <span className="capitalize text-gray-300">{job.state}</span>
          </div>
          <div className="font-mono text-xs text-gray-400">
            <span className="text-gray-500">Job ID:</span>{' '}
            <span className="text-gray-300">{job.job_id}</span>
          </div>
        </div>
      )}
    </div>
  )
}

