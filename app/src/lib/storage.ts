import type { Project, ProjectIndexEntry } from '../types'
import { normalizeProject } from './normalize'

// localStorage keys (per spec's multi-project scheme).
const INDEX_KEY = 'cueflow_index'
const PROJECT_PREFIX = 'cueflow_project_'
const ACTIVE_KEY = 'cueflow_active_id'
// Legacy single-project key — read on first load for backwards compat.
const LEGACY_KEY = 'cueflow_project'

export function projectKey(id: string): string {
  return PROJECT_PREFIX + id
}

export function readIndex(): ProjectIndexEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeIndex(index: ProjectIndexEntry[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

function indexEntry(p: Project): ProjectIndexEntry {
  const shotCount = p.scenes.reduce((n, s) => n + s.shots.length, 0)
  return {
    id: p.id,
    title: p.title,
    updatedAt: p.updatedAt,
    sceneCount: p.scenes.length,
    shotCount,
  }
}

// Persist a project + refresh its index entry. Returns false on failure
// (e.g. quota exceeded) so the UI can surface the export-now warning.
export function saveProject(p: Project): boolean {
  try {
    localStorage.setItem(projectKey(p.id), JSON.stringify(p))
    const index = readIndex().filter((e) => e.id !== p.id)
    index.unshift(indexEntry(p))
    // Keep most-recently-updated first.
    index.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    writeIndex(index)
    localStorage.setItem(ACTIVE_KEY, p.id)
    return true
  } catch (err) {
    console.error('[storage] save failed', err)
    return false
  }
}

export function loadProject(id: string): Project | null {
  try {
    const raw = localStorage.getItem(projectKey(id))
    if (!raw) return null
    // Normalize so old-schema / partial / corrupt data never crashes the app.
    return normalizeProject(JSON.parse(raw))
  } catch {
    return null
  }
}

export function deleteProject(id: string): void {
  localStorage.removeItem(projectKey(id))
  writeIndex(readIndex().filter((e) => e.id !== id))
  if (localStorage.getItem(ACTIVE_KEY) === id) {
    localStorage.removeItem(ACTIVE_KEY)
  }
}

export function getActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_KEY, id)
  else localStorage.removeItem(ACTIVE_KEY)
}

// On first load, migrate any legacy single-project blob into the index.
export function migrateLegacy(): void {
  const raw = localStorage.getItem(LEGACY_KEY)
  if (!raw) return
  try {
    const p = normalizeProject(JSON.parse(raw))
    if (p) saveProject(p)
  } catch {
    /* ignore malformed legacy data */
  } finally {
    localStorage.removeItem(LEGACY_KEY)
  }
}

// Load the most appropriate project to restore on launch. Whatever we load is
// run through normalizeProject (in loadProject), so we write it straight back —
// this self-heals any corrupt/old-schema data on disk immediately, rather than
// relying on the debounced autosave to eventually flush the repaired copy.
export function restoreLastProject(): Project | null {
  migrateLegacy()
  const activeId = getActiveId()
  if (activeId) {
    const p = loadProject(activeId)
    if (p) {
      saveProject(p)
      return p
    }
  }
  const index = readIndex()
  if (index.length) {
    const p = loadProject(index[0].id)
    if (p) {
      saveProject(p)
      return p
    }
  }
  return null
}
