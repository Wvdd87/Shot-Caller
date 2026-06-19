import type {
  Camera,
  Chapter,
  Project,
  Scene,
  Shot,
  VocabItem,
} from '../types'
import { uid } from '../lib/id'
import { htmlToPlainText } from '../lib/script'
import { CAMERA_PALETTE } from '../lib/palette'

export interface AppState {
  project: Project | null
  activeSceneId: string | null
}

export type Action =
  // project lifecycle
  | { type: 'LOAD_PROJECT'; project: Project; sceneId?: string }
  | { type: 'CLOSE_PROJECT' }
  | { type: 'RENAME_PROJECT'; title: string }
  // scenes
  | { type: 'ADD_SCENE'; title?: string }
  | { type: 'DELETE_SCENE'; sceneId: string }
  | { type: 'RENAME_SCENE'; sceneId: string; title: string }
  | { type: 'REORDER_SCENES'; order: string[] }
  | { type: 'SWITCH_SCENE'; sceneId: string }
  // script
  | { type: 'UPDATE_SCRIPT_HTML'; sceneId: string; html: string }
  // shots
  | {
      type: 'CREATE_SHOT'
      sceneId: string
      cameraId: string
      shotType: string
      startIndex: number
      endIndex: number
    }
  | { type: 'UPDATE_SHOT'; sceneId: string; shotId: string; patch: Partial<Shot> }
  | { type: 'DELETE_SHOT'; sceneId: string; shotId: string }
  | {
      type: 'MOVE_SHOT_BOUNDARY'
      sceneId: string
      shotId: string
      startIndex?: number
      endIndex?: number
    }
  // chapters
  | { type: 'CREATE_CHAPTER'; sceneId: string; title: string; scriptIndex: number; endIndex?: number }
  | { type: 'UPDATE_CHAPTER'; sceneId: string; chapterId: string; patch: Partial<Chapter> }
  | { type: 'DELETE_CHAPTER'; sceneId: string; chapterId: string }
  // cameras
  | { type: 'ADD_CAMERA' }
  | { type: 'UPDATE_CAMERA'; cameraId: string; patch: Partial<Camera> }
  | { type: 'DELETE_CAMERA'; cameraId: string }
  // vocab
  | { type: 'ADD_VOCAB'; text: string; category: VocabItem['category'] }
  | { type: 'UPDATE_VOCAB'; vocabId: string; patch: Partial<VocabItem> }
  | { type: 'DELETE_VOCAB'; vocabId: string }
  // settings
  | { type: 'SET_SETTING'; key: 'showRunningTime' | 'scriptTextWidth'; value: boolean | number }
  // live mode
  | { type: 'LIVE_RESET'; sceneId: string }
  | { type: 'LIVE_ADVANCE'; sceneId: string }
  | { type: 'LIVE_BACK'; sceneId: string }
  | { type: 'LIVE_JUMP'; sceneId: string; index: number }
  | { type: 'LIVE_PAUSE_TOGGLE'; sceneId: string }
  | { type: 'LIVE_TICK'; sceneId: string; elapsedSeconds: number }

const now = () => new Date().toISOString()

// ── helpers ──────────────────────────────────────────────────────

function autoPrep(camLabel: string, shotType: string): string {
  return `${camLabel} → ${shotType}`.trim()
}

// Re-sort shots by startIndex and assign sequential 1-based numbers.
function renumber(shots: Shot[]): Shot[] {
  return [...shots]
    .sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex)
    .map((s, i) => ({ ...s, number: i + 1 }))
}

function patchScene(
  project: Project,
  sceneId: string,
  fn: (scene: Scene) => Scene,
): Project {
  return {
    ...project,
    updatedAt: now(),
    scenes: project.scenes.map((s) => (s.id === sceneId ? fn(s) : s)),
  }
}

function withProject(state: AppState, project: Project): AppState {
  return { ...state, project }
}

// ── reducer ──────────────────────────────────────────────────────

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD_PROJECT': {
      const firstScene =
        action.sceneId ??
        [...action.project.scenes].sort((a, b) => a.order - b.order)[0]?.id ??
        null
      return { project: action.project, activeSceneId: firstScene }
    }
    case 'CLOSE_PROJECT':
      return { project: null, activeSceneId: null }

    case 'SWITCH_SCENE':
      return { ...state, activeSceneId: action.sceneId }
  }

  if (!state.project) return state
  const project = state.project

  switch (action.type) {
    case 'RENAME_PROJECT':
      return withProject(state, { ...project, title: action.title, updatedAt: now() })

    case 'ADD_SCENE': {
      const order = project.scenes.length
      const scene: Scene = {
        id: uid(),
        title: action.title || `Scene ${order + 1}`,
        order,
        rawScript: { html: '<p><br></p>', plainText: '' },
        shots: [],
        chapters: [],
        liveState: { currentShotIndex: 0, startedAt: null, elapsedSeconds: 0, paused: false, log: [] },
      }
      return {
        project: { ...project, updatedAt: now(), scenes: [...project.scenes, scene] },
        activeSceneId: scene.id,
      }
    }

    case 'DELETE_SCENE': {
      if (project.scenes.length <= 1) return state // keep at least one
      const scenes = project.scenes
        .filter((s) => s.id !== action.sceneId)
        .map((s, i) => ({ ...s, order: i }))
      const activeSceneId =
        state.activeSceneId === action.sceneId ? scenes[0]?.id ?? null : state.activeSceneId
      return { project: { ...project, updatedAt: now(), scenes }, activeSceneId }
    }

    case 'RENAME_SCENE':
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => ({ ...s, title: action.title })),
      )

    case 'REORDER_SCENES': {
      const byId = new Map(project.scenes.map((s) => [s.id, s]))
      const scenes = action.order
        .map((id, i) => {
          const s = byId.get(id)
          return s ? { ...s, order: i } : null
        })
        .filter((s): s is Scene => s != null)
      return withProject(state, { ...project, updatedAt: now(), scenes })
    }

    case 'UPDATE_SCRIPT_HTML': {
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => {
          const plainText = htmlToPlainText(action.html)
          // Clamp any shot/chapter indices that fall outside the new text.
          const max = plainText.length
          const shots = renumber(
            s.shots.map((sh) => ({
              ...sh,
              startIndex: Math.min(sh.startIndex, max),
              endIndex: Math.min(sh.endIndex, max),
            })),
          )
          const chapters = s.chapters.map((c) => ({
            ...c,
            scriptIndex: Math.min(c.scriptIndex, max),
          }))
          return { ...s, rawScript: { html: action.html, plainText }, shots, chapters }
        }),
      )
    }

    case 'CREATE_SHOT': {
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => {
          const cam = project.settings.cameras.find((c) => c.id === action.cameraId)
          const shot: Shot = {
            id: uid(),
            number: 0,
            cameraId: action.cameraId,
            shotType: action.shotType,
            prepNote: autoPrep(cam?.label || 'CAM', action.shotType),
            prepNoteEdited: false,
            startIndex: action.startIndex,
            endIndex: action.endIndex,
            notes: '',
          }
          return { ...s, shots: renumber([...s.shots, shot]) }
        }),
      )
    }

    case 'UPDATE_SHOT': {
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => {
          const shots = s.shots.map((sh) => {
            if (sh.id !== action.shotId) return sh
            const next = { ...sh, ...action.patch }
            // Keep prep note in sync when shot type changes and note wasn't hand-edited.
            if (
              action.patch.shotType !== undefined &&
              !next.prepNoteEdited &&
              action.patch.prepNote === undefined
            ) {
              const cam = project.settings.cameras.find((c) => c.id === next.cameraId)
              next.prepNote = autoPrep(cam?.label || 'CAM', next.shotType)
            }
            if (action.patch.prepNote !== undefined) next.prepNoteEdited = true
            return next
          })
          return { ...s, shots: renumber(shots) }
        }),
      )
    }

    case 'DELETE_SHOT':
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => ({
          ...s,
          shots: renumber(s.shots.filter((sh) => sh.id !== action.shotId)),
        })),
      )

    case 'MOVE_SHOT_BOUNDARY':
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => {
          const shots = s.shots.map((sh) => {
            if (sh.id !== action.shotId) return sh
            let start = action.startIndex ?? sh.startIndex
            let end = action.endIndex ?? sh.endIndex
            if (end <= start) end = start + 1 // enforce min 1 char
            return { ...sh, startIndex: start, endIndex: end }
          })
          return { ...s, shots: renumber(shots) }
        }),
      )

    case 'CREATE_CHAPTER':
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => ({
          ...s,
          chapters: [
            ...s.chapters,
            { id: uid(), title: action.title, scriptIndex: action.scriptIndex, endIndex: action.endIndex },
          ],
        })),
      )

    case 'UPDATE_CHAPTER':
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => ({
          ...s,
          chapters: s.chapters.map((c) =>
            c.id === action.chapterId ? { ...c, ...action.patch } : c,
          ),
        })),
      )

    case 'DELETE_CHAPTER':
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => ({
          ...s,
          chapters: s.chapters.filter((c) => c.id !== action.chapterId),
        })),
      )

    // ── cameras ──
    case 'ADD_CAMERA': {
      const number =
        project.settings.cameras.reduce((m, c) => Math.max(m, c.number), 0) + 1
      const camera: Camera = {
        id: uid(),
        number,
        label: `CAM ${number}`,
        color: CAMERA_PALETTE[(number - 1) % CAMERA_PALETTE.length].hex,
      }
      return withProject(state, {
        ...project,
        updatedAt: now(),
        settings: { ...project.settings, cameras: [...project.settings.cameras, camera] },
      })
    }
    case 'UPDATE_CAMERA':
      return withProject(state, {
        ...project,
        updatedAt: now(),
        settings: {
          ...project.settings,
          cameras: project.settings.cameras.map((c) =>
            c.id === action.cameraId ? { ...c, ...action.patch } : c,
          ),
        },
      })
    case 'DELETE_CAMERA':
      return withProject(state, {
        ...project,
        updatedAt: now(),
        settings: {
          ...project.settings,
          cameras: project.settings.cameras.filter((c) => c.id !== action.cameraId),
        },
      })

    // ── vocab ──
    case 'ADD_VOCAB':
      return withProject(state, {
        ...project,
        updatedAt: now(),
        settings: {
          ...project.settings,
          shotVocabulary: [
            ...project.settings.shotVocabulary,
            { id: uid(), text: action.text.toUpperCase().trim(), category: action.category },
          ],
        },
      })
    case 'UPDATE_VOCAB':
      return withProject(state, {
        ...project,
        updatedAt: now(),
        settings: {
          ...project.settings,
          shotVocabulary: project.settings.shotVocabulary.map((v) =>
            v.id === action.vocabId
              ? { ...v, ...action.patch, text: (action.patch.text ?? v.text).toUpperCase() }
              : v,
          ),
        },
      })
    case 'DELETE_VOCAB':
      return withProject(state, {
        ...project,
        updatedAt: now(),
        settings: {
          ...project.settings,
          shotVocabulary: project.settings.shotVocabulary.filter((v) => v.id !== action.vocabId),
        },
      })

    case 'SET_SETTING':
      return withProject(state, {
        ...project,
        updatedAt: now(),
        settings: { ...project.settings, [action.key]: action.value },
      })

    // ── live mode ──
    case 'LIVE_RESET':
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => ({
          ...s,
          liveState: { currentShotIndex: 0, startedAt: null, elapsedSeconds: 0, paused: false, log: [] },
        })),
      )

    case 'LIVE_ADVANCE':
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => {
          const ordered = renumber(s.shots)
          const nextIndex = Math.min(s.liveState.currentShotIndex + 1, ordered.length - 1)
          if (nextIndex === s.liveState.currentShotIndex && s.liveState.startedAt) return s
          const shot = ordered[nextIndex]
          const cam = project.settings.cameras.find((c) => c.id === shot?.cameraId)
          const log = shot
            ? [
                ...s.liveState.log,
                {
                  cueNumber: shot.number,
                  shotType: shot.shotType,
                  cameraLabel: cam?.label || 'CAM',
                  advancedAt: now(),
                },
              ]
            : s.liveState.log
          return {
            ...s,
            liveState: {
              ...s.liveState,
              currentShotIndex: nextIndex,
              startedAt: s.liveState.startedAt ?? now(),
              log,
            },
          }
        }),
      )

    case 'LIVE_BACK':
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => ({
          ...s,
          liveState: {
            ...s.liveState,
            currentShotIndex: Math.max(s.liveState.currentShotIndex - 1, 0),
          },
        })),
      )

    case 'LIVE_JUMP':
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => {
          const max = Math.max(s.shots.length - 1, 0)
          return {
            ...s,
            liveState: {
              ...s.liveState,
              currentShotIndex: Math.max(0, Math.min(action.index, max)),
              startedAt: s.liveState.startedAt ?? now(),
            },
          }
        }),
      )

    case 'LIVE_PAUSE_TOGGLE':
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => ({
          ...s,
          liveState: { ...s.liveState, paused: !s.liveState.paused },
        })),
      )

    case 'LIVE_TICK':
      return withProject(
        state,
        patchScene(project, action.sceneId, (s) => ({
          ...s,
          liveState: { ...s.liveState, elapsedSeconds: action.elapsedSeconds },
        })),
      )

    default:
      return state
  }
}
