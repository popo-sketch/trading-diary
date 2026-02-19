import { useMemo } from 'react'
import { computeFlowStatus } from '../utils/flowStatusSignals'

const WHITE = '#ffffff'

export default function FlowStatusModule({ analytics, trades, error }) {
  const flow = useMemo(() => {
    // API fail → neutral message
    if (error) {
      return {
        line1: 'No reliable edge read yet',
        line2: 'Data unavailable. Track consistently and avoid large sizing until signals stabilize. Stabilize.',
        color: WHITE,
      }
    }
    try {
      return computeFlowStatus(analytics ?? null, trades ?? [])
    } catch (err) {
      console.warn('FlowStatusModule error:', err)
      return {
        line1: 'No reliable edge read yet',
        line2: 'Calculation error. Track consistently and avoid large sizing until signals stabilize. Stabilize.',
        color: WHITE,
      }
    }
  }, [analytics, trades, error])

  // Ensure no undefined/null values
  const line1 = flow?.line1 || 'No reliable edge read yet'
  const line2 = flow?.line2 || 'Data unavailable. Track consistently and avoid large sizing until signals stabilize. Stabilize.'
  const color = flow?.color || WHITE

  const colorStyle = { color }

  return (
    <div
      className="text-sm font-medium leading-snug max-w-full break-words"
      style={colorStyle}
    >
      <div className="mb-0.5">{line1}</div>
      <div className="text-xs font-normal opacity-95">{line2}</div>
    </div>
  )
}
