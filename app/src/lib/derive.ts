import type { Camera, ListRow, Scene, Shot } from '../types'

// Ordered shots (by startIndex) — numbers are already maintained by the reducer.
export function orderedShots(scene: Scene): Shot[] {
  return [...scene.shots].sort(
    (a, b) => a.startIndex - b.startIndex || a.number - b.number,
  )
}

// Build the full shotlist as interleaved rows: chapters slotted by scriptIndex,
// orphan chapters (no valid index) pinned to the top.
export function buildRows(scene: Scene): ListRow[] {
  const shots = orderedShots(scene)
  const max = scene.rawScript.plainText.length
  const valid = scene.chapters.filter(
    (c) => c.scriptIndex >= 0 && c.scriptIndex <= max,
  )
  const orphans = scene.chapters.filter(
    (c) => c.scriptIndex < 0 || c.scriptIndex > max,
  )

  const rows: ListRow[] = []
  for (const c of orphans) rows.push({ kind: 'chapter', chapter: c, orphan: true })

  const sortedChapters = [...valid].sort((a, b) => a.scriptIndex - b.scriptIndex)
  let ci = 0
  for (const shot of shots) {
    while (ci < sortedChapters.length && sortedChapters[ci].scriptIndex <= shot.startIndex) {
      rows.push({ kind: 'chapter', chapter: sortedChapters[ci] })
      ci++
    }
    rows.push({ kind: 'shot', shot })
  }
  // Any chapters after the last shot.
  while (ci < sortedChapters.length) {
    rows.push({ kind: 'chapter', chapter: sortedChapters[ci] })
    ci++
  }
  return rows
}

export type BufferLevel = 'SHORT' | 'OK' | 'SAFE'

export interface CameraStatus {
  camera: Camera
  lastShot: Shot | null
  shotsAgo: number // how many shots since this camera was last used
  buffer: BufferLevel
}

// Per-camera buffer status, measured from the end of the shotlist (Edit mode)
// or relative to a given cursor index (Live mode current cue).
export function cameraStatuses(scene: Scene, cameras: Camera[], cursor?: number): CameraStatus[] {
  const shots = orderedShots(scene)
  const upTo = cursor === undefined ? shots.length : Math.min(cursor + 1, shots.length)
  return cameras.map((camera) => {
    let lastShot: Shot | null = null
    let lastIdx = -1
    for (let i = upTo - 1; i >= 0; i--) {
      if (shots[i].cameraId === camera.id) {
        lastShot = shots[i]
        lastIdx = i
        break
      }
    }
    const shotsAgo = lastIdx === -1 ? upTo : upTo - 1 - lastIdx
    // Intervening characters of script text since last use.
    let chars = 0
    if (lastShot) {
      for (let i = lastIdx + 1; i < upTo; i++) {
        chars += Math.max(0, shots[i].endIndex - shots[i].startIndex)
      }
    } else {
      chars = Infinity
    }
    let buffer: BufferLevel = 'SAFE'
    if (chars < 80) buffer = 'SHORT'
    else if (chars <= 300) buffer = 'OK'
    return { camera, lastShot, shotsAgo, buffer }
  })
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function pad3(n: number): string {
  return String(n).padStart(3, '0')
}
