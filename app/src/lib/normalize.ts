import type {
  Camera,
  Chapter,
  LiveLogEntry,
  LiveState,
  Project,
  Scene,
  Settings,
  Shot,
  VocabItem,
} from '../types'
import { uid } from './id'
import { defaultCameras, defaultVocab, makeScene } from './factory'
import { htmlToPlainText } from './script'

// Coerce arbitrary (possibly old-schema, partial, or corrupt) stored data into
// a valid Project. Returns null only when there's nothing project-like at all.
// This keeps long-lived localStorage forward/backward compatible across builds
// and prevents a single bad field from white-screening the app.
export function normalizeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  // Must look at least vaguely like a project (has a title or scenes).
  if (typeof r.title !== 'string' && !Array.isArray(r.scenes)) return null

  const now = new Date().toISOString()
  const settings = normalizeSettings(r.settings)
  let scenes = Array.isArray(r.scenes)
    ? (r.scenes as unknown[]).map((s, i) => normalizeScene(s, i)).filter((s): s is Scene => !!s)
    : []
  if (scenes.length === 0) scenes = [makeScene(0, 'Scene 1')]
  scenes = scenes.map((s, i) => ({ ...s, order: i }))

  return {
    id: typeof r.id === 'string' ? r.id : uid(),
    title: typeof r.title === 'string' && r.title.trim() ? r.title : 'Untitled Production',
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
    settings,
    scenes,
  }
}

function normalizeSettings(raw: unknown): Settings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const cameras = Array.isArray(s.cameras)
    ? (s.cameras as unknown[]).map(normalizeCamera).filter((c): c is Camera => !!c)
    : []
  const shotVocabulary = Array.isArray(s.shotVocabulary)
    ? (s.shotVocabulary as unknown[]).map(normalizeVocab).filter((v): v is VocabItem => !!v)
    : []
  return {
    cameras: cameras.length ? cameras : defaultCameras(),
    shotVocabulary: shotVocabulary.length ? shotVocabulary : defaultVocab(),
    showRunningTime: s.showRunningTime !== false,
    scriptTextWidth: typeof s.scriptTextWidth === 'number' ? s.scriptTextWidth : 480,
  }
}

function normalizeCamera(raw: unknown): Camera | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  return {
    id: typeof c.id === 'string' ? c.id : uid(),
    number: typeof c.number === 'number' ? c.number : 1,
    label: typeof c.label === 'string' ? c.label : `CAM ${c.number ?? 1}`,
    color: typeof c.color === 'string' ? c.color : '#E84040',
  }
}

function normalizeVocab(raw: unknown): VocabItem | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  if (typeof v.text !== 'string') return null
  const cat = v.category
  return {
    id: typeof v.id === 'string' ? v.id : uid(),
    text: v.text.toUpperCase(),
    category: cat === 'CHARACTER' || cat === 'SHOT_SIZE' || cat === 'CUSTOM' ? cat : 'CUSTOM',
  }
}

function normalizeScene(raw: unknown, index: number): Scene | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const rs = (s.rawScript && typeof s.rawScript === 'object' ? s.rawScript : {}) as Record<string, unknown>
  const html = typeof rs.html === 'string' ? rs.html : '<p><br></p>'
  const plainText = typeof rs.plainText === 'string' ? rs.plainText : htmlToPlainText(html)
  const shots = Array.isArray(s.shots)
    ? (s.shots as unknown[]).map(normalizeShot).filter((x): x is Shot => !!x)
    : []
  // Re-number shots by reading order so old data is always consistent.
  const ordered = shots
    .sort((a, b) => a.startIndex - b.startIndex)
    .map((sh, i) => ({ ...sh, number: i + 1 }))
  return {
    id: typeof s.id === 'string' ? s.id : uid(),
    title: typeof s.title === 'string' ? s.title : `Scene ${index + 1}`,
    order: typeof s.order === 'number' ? s.order : index,
    rawScript: { html, plainText },
    shots: ordered,
    chapters: Array.isArray(s.chapters)
      ? (s.chapters as unknown[]).map(normalizeChapter).filter((x): x is Chapter => !!x)
      : [],
    liveState: normalizeLiveState(s.liveState),
  }
}

function normalizeShot(raw: unknown): Shot | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (typeof s.startIndex !== 'number' || typeof s.endIndex !== 'number') return null
  return {
    id: typeof s.id === 'string' ? s.id : uid(),
    number: typeof s.number === 'number' ? s.number : 0,
    cameraId: typeof s.cameraId === 'string' ? s.cameraId : '',
    shotType: typeof s.shotType === 'string' ? s.shotType : '',
    prepNote: typeof s.prepNote === 'string' ? s.prepNote : '',
    prepNoteEdited: s.prepNoteEdited === true,
    startIndex: s.startIndex,
    endIndex: s.endIndex,
    notes: typeof s.notes === 'string' ? s.notes : '',
  }
}

function normalizeChapter(raw: unknown): Chapter | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  return {
    id: typeof c.id === 'string' ? c.id : uid(),
    title: typeof c.title === 'string' ? c.title : 'Chapter',
    scriptIndex: typeof c.scriptIndex === 'number' ? c.scriptIndex : -1,
  }
}

function normalizeLiveState(raw: unknown): LiveState {
  const l = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const log = Array.isArray(l.log)
    ? (l.log as unknown[])
        .filter((e): e is LiveLogEntry => !!e && typeof e === 'object')
        .map((e) => e as LiveLogEntry)
    : []
  return {
    currentShotIndex: typeof l.currentShotIndex === 'number' ? l.currentShotIndex : 0,
    startedAt: typeof l.startedAt === 'string' ? l.startedAt : null,
    elapsedSeconds: typeof l.elapsedSeconds === 'number' ? l.elapsedSeconds : 0,
    paused: l.paused === true,
    log,
  }
}
