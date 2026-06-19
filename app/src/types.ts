// ── Shotcaller data model ──────────────────────────────────────────
// Mirrors the spec's data model. The whole Project is the single source
// of truth, serialized to localStorage. No backend.

export type VocabCategory = 'CHARACTER' | 'SHOT_SIZE' | 'CUSTOM'

export interface Camera {
  id: string
  number: number // display number e.g. 1, 2, 3
  label: string // e.g. "CAM 1"
  color: string // hex from the 12-color palette
}

export interface VocabItem {
  id: string
  text: string // always UPPERCASE
  category: VocabCategory
}

export interface Settings {
  cameras: Camera[]
  shotVocabulary: VocabItem[]
  showRunningTime: boolean
  scriptTextWidth?: number // live-mode SCRIPT TEXT column width (px)
}

export interface Shot {
  id: string
  number: number // sequential 1-based, recalculated on every change
  cameraId: string
  shotType: string // free text
  prepNote: string // auto-generated, editable
  prepNoteEdited: boolean
  startIndex: number // character index into rawScript.plainText
  endIndex: number
  notes: string // director's private notes, not shown in live mode
}

export interface Chapter {
  id: string
  title: string
  scriptIndex: number // character index into rawScript.plainText (start of heading)
  endIndex?: number // end of the heading text (for the grey cue-mode highlight)
}

export interface LiveLogEntry {
  cueNumber: number
  shotType: string
  cameraLabel: string
  advancedAt: string // ISO datetime, local timezone
}

export interface LiveState {
  currentShotIndex: number // 0-based index into ordered shots
  startedAt: string | null
  elapsedSeconds: number
  paused: boolean
  log: LiveLogEntry[]
}

export interface RawScript {
  html: string // full script as HTML — single source of truth
  plainText: string // stripped version, indices reference this
}

export interface Scene {
  id: string
  title: string
  order: number
  rawScript: RawScript
  shots: Shot[]
  chapters: Chapter[]
  liveState: LiveState
}

export interface Project {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  settings: Settings
  scenes: Scene[]
}

// Lightweight index entry persisted alongside each project.
export interface ProjectIndexEntry {
  id: string
  title: string
  updatedAt: string
  sceneCount: number
  shotCount: number
}

// ── Derived / view types ──

// A row in the ordered shotlist — either a shot or a chapter divider.
export type ListRow =
  | { kind: 'shot'; shot: Shot }
  | { kind: 'chapter'; chapter: Chapter; orphan?: boolean }
