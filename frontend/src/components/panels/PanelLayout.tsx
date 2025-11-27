import { ReactNode, useEffect } from 'react'
import { Panel, PanelGroup, ResizeHandle } from './ResizablePanels'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils'

interface PanelLayoutProps {
  library: ReactNode
  studio: ReactNode | null
  transcription: ReactNode | null
  onCloseStudio: () => void
  onCloseTranscription: () => void
}

export function PanelLayout({
  library,
  studio,
  transcription,
  onCloseStudio,
  onCloseTranscription,
}: PanelLayoutProps) {
  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (transcription) {
          onCloseTranscription()
        } else if (studio) {
          onCloseStudio()
        }
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [studio, transcription, onCloseStudio, onCloseTranscription])

  const hasStudio = !!studio
  const hasTranscription = !!transcription

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Library - Always rendered underneath */}
      <div className="h-full w-full">{library}</div>

      {/* Panels Container - Slides in from right when studio opens */}
      <AnimatePresence>
        {hasStudio && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-40"
          >
            <PanelGroup direction="horizontal">
              {/* Transcription Panel - Conditionally rendered */}
              {hasTranscription ? (
                <>
                  <Panel
                    id="transcription"
                    defaultSize={20}
                    minSize={15}
                    maxSize={40}
                    className="relative overflow-hidden"
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key="transcription"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                      >
                        <div className="panel-glass h-full border-r border-white/10 shadow-2xl">
                          {transcription}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </Panel>
                  <ResizeHandle leftPanelId="transcription" rightPanelId="studio" />
                </>
              ) : null}

              {/* Studio Panel */}
              <Panel
                id="studio"
                defaultSize={hasTranscription ? 80 : 100}
                minSize={hasTranscription ? 60 : 70}
                className={!hasTranscription ? 'flex-1' : ''}
              >
                <div className="panel-glass h-full shadow-2xl">
                  {studio}
                </div>
              </Panel>
            </PanelGroup>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
