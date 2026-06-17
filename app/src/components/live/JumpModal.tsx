import { useEffect, useState } from 'react'
import type { Camera, Scene } from '../../types'
import { orderedShots, pad3 } from '../../lib/derive'
import { displayText } from '../../lib/script'
import { contrastText } from '../../lib/palette'
import { Icon } from '../common/Icon'

interface Props {
  scene: Scene
  cameras: Camera[]
  onJump: (index: number) => void
  onClose: () => void
}

export function JumpModal({ scene, cameras, onJump, onClose }: Props) {
  const shots = orderedShots(scene)
  const [value, setValue] = useState('')
  const num = parseInt(value, 10)
  const targetIndex = shots.findIndex((s) => s.number === num)
  const target = targetIndex >= 0 ? shots[targetIndex] : null
  const cam = target ? cameras.find((c) => c.id === target.cameraId) : null

  const confirm = (idx: number) => {
    if (idx >= 0) onJump(idx)
  }

  // Close on Escape (the modal swallows the key so Live Mode doesn't also act).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="eyebrow">Live</div>
            <h3>Jump to Cue</h3>
          </div>
          <button className="close" onClick={onClose}><Icon name="x" size={12} /></button>
        </div>
        <div className="modal-body">
          <div className="jump-input input">
            <input
              autoFocus
              inputMode="numeric"
              placeholder="CUE #"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirm(targetIndex)
              }}
            />
          </div>
          {target && (
            <div className="jump-preview">
              <span className="cam-badge" style={{ background: cam?.color, color: contrastText(cam?.color || '#888') }}>
                {cam?.number}
              </span>
              <span className="jp-type">{target.shotType}</span>
              <span className="jp-script">{displayText(scene.rawScript.plainText.slice(target.startIndex, target.endIndex))}</span>
            </div>
          )}

          {scene.chapters.length > 0 && (
            <div className="jump-chapters">
              <div className="section-eyebrow">Chapters</div>
              {[...scene.chapters]
                .sort((a, b) => a.scriptIndex - b.scriptIndex)
                .map((ch) => {
                  // First shot at/after the chapter's script position.
                  const idx = shots.findIndex((s) => s.startIndex >= ch.scriptIndex)
                  const shot = idx >= 0 ? shots[idx] : null
                  return (
                    <button key={ch.id} className="jump-chapter" onClick={() => confirm(idx)} disabled={idx < 0}>
                      <span className="jc-title">{ch.title.toUpperCase()}</span>
                      <span className="jc-num mono">{shot ? pad3(shot.number) : '—'}</span>
                    </button>
                  )
                })}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={targetIndex < 0} onClick={() => confirm(targetIndex)}>
            Jump
          </button>
        </div>
      </div>
    </div>
  )
}
