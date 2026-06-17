import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Project, Scene } from '../types'
import { reducer, type Action, type AppState } from './reducer'
import { restoreLastProject, saveProject } from '../lib/storage'

interface SaveStatus {
  savedAt: string | null // formatted HH:MM:SS
  ok: boolean
  failed: boolean
}

interface Ctx {
  state: AppState
  dispatch: React.Dispatch<Action>
  project: Project | null
  activeScene: Scene | null
  saveStatus: SaveStatus
  saveNow: () => void
}

const AppContext = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    let project: Project | null = null
    try {
      project = restoreLastProject()
    } catch (err) {
      console.error('[shotcaller] failed to restore project', err)
      project = null
    }
    const scenes = project && Array.isArray(project.scenes) ? project.scenes : []
    const activeSceneId =
      scenes.length > 0 ? [...scenes].sort((a, b) => a.order - b.order)[0]?.id ?? null : null
    return { project, activeSceneId }
  })

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    savedAt: null,
    ok: true,
    failed: false,
  })

  // Debounced autosave (500ms) on every project mutation.
  const timer = useRef<number | undefined>(undefined)
  const lastSerialized = useRef<string>('')

  const persist = (project: Project) => {
    const ok = saveProject(project)
    setSaveStatus({
      savedAt: ok ? new Date().toLocaleTimeString('en-GB') : null,
      ok,
      failed: !ok,
    })
  }

  useEffect(() => {
    if (!state.project) return
    const serialized = JSON.stringify(state.project)
    if (serialized === lastSerialized.current) return
    lastSerialized.current = serialized
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => persist(state.project!), 500)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [state.project])

  const saveNow = () => {
    if (state.project) persist(state.project)
  }

  const activeScene = useMemo<Scene | null>(() => {
    if (!state.project) return null
    return state.project.scenes.find((s) => s.id === state.activeSceneId) ?? null
  }, [state.project, state.activeSceneId])

  const value: Ctx = {
    state,
    dispatch,
    project: state.project,
    activeScene,
    saveStatus,
    saveNow,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
