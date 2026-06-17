import type { Camera, Project, Scene, Settings, VocabItem } from '../types'
import { uid } from './id'
import { CAMERA_PALETTE } from './palette'

const SHOT_SIZES = ['WS', 'MS', 'MCU', 'CU', 'ECU', '2-SHOT', 'OTS', 'WIDE', 'LOW', 'HIGH']

export function defaultVocab(): VocabItem[] {
  return SHOT_SIZES.map((text) => ({ id: uid(), text, category: 'SHOT_SIZE' as const }))
}

export function makeCamera(number: number): Camera {
  const color = CAMERA_PALETTE[(number - 1) % CAMERA_PALETTE.length].hex
  return { id: uid(), number, label: `CAM ${number}`, color }
}

export function defaultCameras(): Camera[] {
  return [1, 2, 3].map(makeCamera)
}

export function defaultSettings(): Settings {
  return {
    cameras: defaultCameras(),
    shotVocabulary: defaultVocab(),
    showRunningTime: true,
    scriptTextWidth: 480,
  }
}

export function makeScene(order: number, title?: string): Scene {
  return {
    id: uid(),
    title: title || `Scene ${order + 1}`,
    order,
    rawScript: { html: '<p><br></p>', plainText: '' },
    shots: [],
    chapters: [],
    liveState: {
      currentShotIndex: 0,
      startedAt: null,
      elapsedSeconds: 0,
      paused: false,
      log: [],
    },
  }
}

export function makeProject(title: string): Project {
  const now = new Date().toISOString()
  return {
    id: uid(),
    title: title.trim() || 'Untitled Project',
    createdAt: now,
    updatedAt: now,
    settings: defaultSettings(),
    scenes: [makeScene(0, 'Scene 1')],
  }
}
