import type { Camera, Project, Scene } from '../types'
import { buildRows, orderedShots, pad3 } from './derive'
import { sliceText, displayText } from './script'
import { normalizeProject } from './normalize'

// ── generic download helpers ──────────────────────────────────────
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'project'
}

function csvCell(v: string | number): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function rowsToCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

// ── project JSON ──────────────────────────────────────────────────
export function exportProjectJson(project: Project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  download(blob, `${slug(project.title)}.shotcaller.json`)
}

export function importProjectJson(file: File): Promise<Project> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = normalizeProject(JSON.parse(String(reader.result)))
        if (!data) {
          throw new Error('Not a valid Shotcaller project file.')
        }
        resolve(data)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not read project file.'))
      }
    }
    reader.onerror = () => reject(new Error('Could not read file.'))
    reader.readAsText(file)
  })
}

// ── shotlist exports ──────────────────────────────────────────────
function shotlistRows(scene: Scene, cameras: Camera[]): (string | number)[][] {
  const text = scene.rawScript.plainText
  const rows: (string | number)[][] = []
  for (const row of buildRows(scene)) {
    if (row.kind === 'chapter') {
      rows.push([`▶ ${row.chapter.title.toUpperCase()}`, '', '', ''])
    } else {
      const s = row.shot
      const cam = cameras.find((c) => c.id === s.cameraId)
      rows.push([
        pad3(s.number),
        s.prepNote,
        `${cam?.label || 'CAM'} · ${s.shotType}`,
        displayText(sliceText(text, s.startIndex, s.endIndex)),
      ])
    }
  }
  return rows
}

export function exportShotlistCsv(scene: Scene, cameras: Camera[], project: Project) {
  const header = ['#', 'Next Action', 'Cam / Shot', 'Script Text']
  const csv = rowsToCsv([header, ...shotlistRows(scene, cameras)])
  download(new Blob([csv], { type: 'text/csv' }), `${slug(project.title)}-${slug(scene.title)}-shotlist.csv`)
}

// jsPDF + autotable are heavy and only needed on demand — load lazily so the
// initial app bundle stays light (offline-first first paint).
async function loadPdf() {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  return { jsPDF, autoTable: autoTableMod.default }
}

export async function exportShotlistPdf(scene: Scene, cameras: Camera[], project: Project) {
  const { jsPDF, autoTable } = await loadPdf()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(project.title.toUpperCase(), 40, 44)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`${scene.title}  ·  ${orderedShots(scene).length} shots`, 40, 60)

  autoTable(doc, {
    startY: 76,
    head: [['#', 'NEXT ACTION', 'CAM / SHOT', 'SCRIPT TEXT']],
    body: shotlistRows(scene, cameras),
    styles: { fontSize: 8, cellPadding: 4, valign: 'top', lineColor: [200, 200, 200], lineWidth: 0.5 },
    headStyles: { fillColor: [17, 17, 22], textColor: [240, 168, 56], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 32, font: 'courier' },
      1: { cellWidth: 120 },
      2: { cellWidth: 100, fontStyle: 'bold' },
      3: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      // Chapter rows span and stand out.
      const raw = data.row.raw as (string | number)[]
      if (typeof raw[0] === 'string' && raw[0].startsWith('▶') && data.section === 'body') {
        data.cell.styles.fillColor = [235, 235, 235]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  doc.save(`${slug(project.title)}-${slug(scene.title)}-shotlist.pdf`)
}

// ── live log exports ──────────────────────────────────────────────
function logRows(scene: Scene): (string | number)[][] {
  return scene.liveState.log.map((e) => [
    pad3(e.cueNumber),
    e.cameraLabel,
    e.shotType,
    new Date(e.advancedAt).toLocaleTimeString('en-GB'),
  ])
}

export function exportLiveLogCsv(scene: Scene, project: Project) {
  const header = ['Cue #', 'Camera', 'Shot', 'Time']
  const csv = rowsToCsv([header, ...logRows(scene)])
  download(new Blob([csv], { type: 'text/csv' }), `${slug(project.title)}-${slug(scene.title)}-log.csv`)
}

export async function exportLiveLogPdf(scene: Scene, project: Project) {
  const { jsPDF, autoTable } = await loadPdf()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(`${project.title.toUpperCase()} — CUE LOG`, 40, 44)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`${scene.title}  ·  ${scene.liveState.log.length} advances`, 40, 60)
  autoTable(doc, {
    startY: 76,
    head: [['CUE #', 'CAMERA', 'SHOT', 'TIME']],
    body: logRows(scene),
    styles: { fontSize: 9, cellPadding: 5, lineColor: [200, 200, 200], lineWidth: 0.5 },
    headStyles: { fillColor: [17, 17, 22], textColor: [240, 168, 56], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 50, font: 'courier' }, 3: { font: 'courier' } },
  })
  doc.save(`${slug(project.title)}-${slug(scene.title)}-log.pdf`)
}
