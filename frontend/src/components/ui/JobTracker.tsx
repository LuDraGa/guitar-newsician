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
  songName?: string
  actionName?: string
  onComplete?: (job: Job) => void
  onError?: (job: Job) => void
  onDismiss?: (jobId: string) => void
  className?: string
}

export function JobTracker({ jobId, songName, actionName, onComplete, onError, onDismiss, className }: JobTrackerProps) {
  const [job, setJob] = useState<Job | null>(null)
  const [expanded, setExpanded] = useState(false) // Collapsed by default for cleaner UI

  // Derive action name from job type if not provided
  const getActionName = (jobType?: string) => {
    if (actionName) return actionName
    if (!jobType) return undefined
    const typeMap: Record<string, string> = {
      'convert': 'Convert to WAV',
      'analysis': 'Full Analysis',
      'stem_separation': 'Stem Separation',
      'download': 'Download',
    }
    return typeMap[jobType] || jobType.replace('_', ' ')
  }

  const displayActionName = getActionName(job?.job_type)

  const pollJob = useCallback(async () => {
    try {
      const response = await jobsApi.getJob(jobId)
      // API wraps job in {status: JobStatus} - extract it
      const data = response.status || response

      console.log('[JobTracker] Poll response:', response)
      console.log('[JobTracker] Extracted job:', data)
      console.log('[JobTracker] Job type:', data.job_type)

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
      <div className={cn('rounded-xl border border-white/10 bg-dark-200/90 p-4 shadow-2xl backdrop-blur-sm', className)}>
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          <span className="font-sans text-sm font-medium text-gray-300">Initializing...</span>
        </div>
      </div>
    )
  }

  const state = job.state || 'queued'

  // Enhanced state styles with gradients and shadows
  const stateStyles = {
    queued: 'border-blue-500/40 bg-gradient-to-br from-blue-500/15 to-blue-600/10 shadow-lg shadow-blue-500/20',
    running: 'border-accent-500/40 bg-gradient-to-br from-accent-500/15 to-accent-600/10 shadow-lg shadow-accent-500/20',
    completed: 'border-green-500/40 bg-gradient-to-br from-green-500/15 to-green-600/10 shadow-lg shadow-green-500/20',
    failed: 'border-red-500/40 bg-gradient-to-br from-red-500/15 to-red-600/10 shadow-lg shadow-red-500/20',
  }

  const stateIcons = {
    queued: (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20">
        <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
    running: (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-500/20">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-400 border-t-transparent" />
      </div>
    ),
    completed: (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
        <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    failed: (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
        <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    ),
  }

  const stateBadges = {
    queued: (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-blue-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
        Queued
      </span>
    ),
    running: (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/20 px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-accent-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-400" />
        Running
      </span>
    ),
    completed: (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-green-300">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        Completed
      </span>
    ),
    failed: (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-red-300">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Failed
      </span>
    ),
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border backdrop-blur-sm', stateStyles[state], className)}>
      {/* Main content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* State icon */}
          <div className="flex-shrink-0">{stateIcons[state]}</div>

          {/* Content */}
          <div className="flex-1 space-y-2">
            {/* Song name - bold and prominent */}
            {songName && (
              <div className="font-sans text-base font-bold leading-tight text-white">
                {songName}
              </div>
            )}

            {/* Action name and status badge */}
            <div className="flex flex-wrap items-center gap-2">
              {displayActionName && (
                <span className="font-sans text-sm font-semibold text-gray-200">
                  {displayActionName}
                </span>
              )}
              {stateBadges[state]}
            </div>

            {/* Progress message */}
            {job.message && (
              <p className="font-mono text-xs leading-relaxed text-gray-400">{job.message}</p>
            )}

            {/* Progress bar for running jobs */}
            {state === 'running' && job.progress !== undefined && (
              <div className="space-y-1.5">
                <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-accent-500 to-accent-400 transition-all duration-500 ease-out"
                    style={{ width: `${job.progress}%` }}
                  >
                    <div className="absolute inset-0 animate-pulse bg-white/20" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-medium text-accent-300">
                    {Math.round(job.progress)}%
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {job.progress < 100 ? 'Processing...' : 'Finishing up...'}
                  </span>
                </div>
              </div>
            )}

            {/* Error message */}
            {job.error && (
              <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-3">
                <div className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="flex-1 font-mono text-xs leading-relaxed text-red-200">{job.error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-shrink-0 items-start gap-1">
            {onDismiss && (
              <button
                onClick={() => onDismiss(jobId)}
                className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-red-500/20 hover:text-red-300"
                title="Dismiss"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-white/10 hover:text-white"
              title={expanded ? 'Collapse details' : 'Expand details'}
            >
              <svg
                className={cn('h-4 w-4 transition-transform duration-200', expanded && 'rotate-180')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-white/10 bg-black/20 p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-medium text-gray-500">Job ID</span>
              <span className="font-mono text-xs text-gray-300">{job.job_id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-medium text-gray-500">Type</span>
              <span className="font-mono text-xs capitalize text-gray-300">{job.job_type || 'unknown'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-medium text-gray-500">State</span>
              <span className="font-mono text-xs capitalize text-gray-300">{job.state}</span>
            </div>
            {job.progress !== undefined && (
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-medium text-gray-500">Progress</span>
                <span className="font-mono text-xs text-gray-300">{job.progress.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
