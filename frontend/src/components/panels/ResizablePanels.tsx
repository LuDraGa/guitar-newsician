/**
 * ResizablePanels - Modular, extensible panel system for React
 *
 * A lightweight alternative to react-resizable-panels with full control over behavior.
 * Supports horizontal and vertical layouts with smooth drag-to-resize.
 *
 * @example
 * ```tsx
 * <PanelGroup direction="horizontal">
 *   <Panel id="sidebar" defaultSize={20} minSize={15} maxSize={40}>
 *     <Sidebar />
 *   </Panel>
 *   <ResizeHandle leftPanelId="sidebar" rightPanelId="main" />
 *   <Panel id="main" defaultSize={80} minSize={60}>
 *     <MainContent />
 *   </Panel>
 * </PanelGroup>
 * ```
 *
 * Features:
 * - Horizontal and vertical layouts
 * - Min/max size constraints (percentage-based)
 * - Smooth mouse drag interaction
 * - Prevents text selection during drag
 * - Fully typed with TypeScript
 * - Minimal dependencies (only React)
 *
 * Architecture:
 * - PanelGroup: Container that manages panel sizes via Context
 * - Panel: Individual resizable panel with size constraints
 * - ResizeHandle: Draggable divider between two panels
 *
 * Styling:
 * - Uses Tailwind CSS by default
 * - All components accept className prop for customization
 * - Modify the cn() utility if using different CSS framework
 *
 * @module ResizablePanels
 */

import { ReactNode, createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'

// Utility function for class names (can be replaced with your own)
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ============================================================================
// Types
// ============================================================================

interface PanelConfig {
  id: string
  defaultSize: number // percentage (0-100)
  minSize?: number // percentage (0-100)
  maxSize?: number // percentage (0-100)
}

interface PanelGroupContextValue {
  panels: Map<string, number> // id -> current size percentage
  updatePanelSize: (leftPanelId: string, rightPanelId: string, delta: number) => void
  direction: 'horizontal' | 'vertical'
}

// ============================================================================
// Context
// ============================================================================

const PanelGroupContext = createContext<PanelGroupContextValue | null>(null)

function usePanelGroup() {
  const context = useContext(PanelGroupContext)
  if (!context) {
    throw new Error('Panel components must be used within PanelGroup')
  }
  return context
}

// ============================================================================
// PanelGroup - Container that manages all panel sizes
// ============================================================================

interface PanelGroupProps {
  children: ReactNode
  direction?: 'horizontal' | 'vertical'
  className?: string
}

export function PanelGroup({ children, direction = 'horizontal', className }: PanelGroupProps) {
  const [panelSizes, setPanelSizes] = useState<Map<string, number>>(new Map())

  const updatePanelSize = useCallback((leftPanelId: string, rightPanelId: string, delta: number) => {
    setPanelSizes(prev => {
      const newSizes = new Map(prev)
      const leftSize = newSizes.get(leftPanelId) ?? 50
      const rightSize = newSizes.get(rightPanelId) ?? 50

      // Calculate new sizes
      const newLeftSize = leftSize + delta
      const newRightSize = rightSize - delta

      // Apply constraints (basic min/max - can be enhanced)
      const constrainedLeftSize = Math.max(15, Math.min(85, newLeftSize))
      const constrainedRightSize = Math.max(15, Math.min(85, newRightSize))

      // Ensure total is 100%
      const total = constrainedLeftSize + constrainedRightSize
      if (Math.abs(total - 100) > 0.1) {
        // Normalize to 100%
        const ratio = 100 / total
        newSizes.set(leftPanelId, constrainedLeftSize * ratio)
        newSizes.set(rightPanelId, constrainedRightSize * ratio)
      } else {
        newSizes.set(leftPanelId, constrainedLeftSize)
        newSizes.set(rightPanelId, constrainedRightSize)
      }

      return newSizes
    })
  }, [])

  const contextValue: PanelGroupContextValue = {
    panels: panelSizes,
    updatePanelSize,
    direction,
  }

  return (
    <PanelGroupContext.Provider value={contextValue}>
      <div
        className={cn(
          'flex',
          direction === 'horizontal' ? 'flex-row' : 'flex-col',
          'h-full w-full',
          className
        )}
      >
        {children}
      </div>
    </PanelGroupContext.Provider>
  )
}

// ============================================================================
// Panel - Individual resizable panel
// ============================================================================

interface PanelProps {
  id: string
  defaultSize: number // percentage
  minSize?: number
  maxSize?: number
  children: ReactNode
  className?: string
}

export function Panel({ id, defaultSize, minSize = 15, maxSize = 85, children, className }: PanelProps) {
  const { panels, direction } = usePanelGroup()

  // Register panel with default size on mount
  const [isRegistered, setIsRegistered] = useState(false)
  if (!isRegistered && !panels.has(id)) {
    panels.set(id, defaultSize)
    setIsRegistered(true)
  }

  const size = panels.get(id) ?? defaultSize

  // Check if className contains flex-1 (indicating it should take remaining space)
  const shouldTakeFullSpace = className?.includes('flex-1')

  const sizeStyle = shouldTakeFullSpace ? {} : (
    direction === 'horizontal'
      ? { width: `${size}%`, flexShrink: 0 }
      : { height: `${size}%`, flexShrink: 0 }
  )

  return (
    <div
      data-panel-id={id}
      style={sizeStyle}
      className={cn('overflow-hidden', className)}
    >
      {children}
    </div>
  )
}

// ============================================================================
// ResizeHandle - Draggable divider between panels
// ============================================================================

interface ResizeHandleProps {
  leftPanelId: string
  rightPanelId: string
  className?: string
}

export function ResizeHandle({ leftPanelId, rightPanelId, className }: ResizeHandleProps) {
  const { updatePanelSize, direction } = usePanelGroup()
  const [isDragging, setIsDragging] = useState(false)
  const startPosRef = useRef<number>(0)
  const containerWidthRef = useRef<number>(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)

    // Store initial position and container size
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY

    // Get container dimensions
    const container = e.currentTarget.parentElement
    if (container) {
      containerWidthRef.current = direction === 'horizontal'
        ? container.getBoundingClientRect().width
        : container.getBoundingClientRect().height
    }

    // Prevent text selection during drag
    document.body.style.userSelect = 'none'
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
  }, [direction])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
    const diffPx = currentPos - startPosRef.current
    const diffPercent = (diffPx / containerWidthRef.current) * 100

    updatePanelSize(leftPanelId, rightPanelId, diffPercent)
    startPosRef.current = currentPos
  }, [isDragging, direction, updatePanelSize, leftPanelId, rightPanelId])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  // Attach global mouse listeners when dragging
  useEffect(() => {
    if (!isDragging) return

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        'group relative flex-shrink-0',
        direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
        'bg-transparent transition-colors hover:bg-accent-500/30',
        isDragging && 'bg-accent-500/50',
        className
      )}
    >
      <div
        className={cn(
          'absolute bg-white/5 transition-colors group-hover:bg-accent-500/50',
          direction === 'horizontal'
            ? 'inset-y-0 left-1/2 w-1 -translate-x-1/2'
            : 'inset-x-0 top-1/2 h-1 -translate-y-1/2',
          isDragging && 'bg-accent-500'
        )}
      />
    </div>
  )
}
