import { useEffect, useState } from 'react'
import { useApp } from './state/context'
import { Welcome } from './components/Welcome'
import { EditMode } from './components/EditMode'
import { LiveMode } from './components/live/LiveMode'
import { ConfirmModal } from './components/common/ConfirmModal'

export type Mode = 'edit' | 'live'

export function App() {
  const { project, activeScene } = useApp()
  const [mode, setMode] = useState<Mode>('edit')
  const [confirmLive, setConfirmLive] = useState(false)

  // If the project closes, snap back to edit.
  useEffect(() => {
    if (!project) setMode('edit')
  }, [project])

  if (!project) {
    return <Welcome />
  }

  const requestLive = () => {
    if (!activeScene || activeScene.shots.length === 0) return
    setConfirmLive(true)
  }

  return (
    <>
      {mode === 'edit' ? (
        <EditMode onGoLive={requestLive} />
      ) : (
        <LiveMode onExit={() => setMode('edit')} />
      )}

      {confirmLive && (
        <ConfirmModal
          eyebrow="Mode Switch"
          title="Enter Live Mode"
          body="Switch to the full-screen cueing view. You'll start at Cue 1. Use Space / ↓ to advance, ↑ to go back, J to jump, P to pause."
          confirmLabel="Go Live"
          onConfirm={() => {
            setConfirmLive(false)
            setMode('live')
          }}
          onCancel={() => setConfirmLive(false)}
        />
      )}
    </>
  )
}
