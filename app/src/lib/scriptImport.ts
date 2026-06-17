import { plainTextToHtml } from './script'

export interface ImportResult {
  html: string
  sourceName: string
}

// .docx → HTML, preserving paragraph structure & basic formatting via mammoth.
export async function importDocx(file: File): Promise<ImportResult> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  let html = result.value || ''
  if (!html.trim()) html = '<p><br></p>'
  return { html, sourceName: file.name }
}

// .txt → paragraph HTML.
export async function importTxt(file: File): Promise<ImportResult> {
  const text = await file.text()
  return { html: plainTextToHtml(text), sourceName: file.name }
}

// Pasted plain text → paragraph HTML.
export function importPaste(text: string): ImportResult {
  return { html: plainTextToHtml(text), sourceName: 'Pasted text' }
}

export async function importByExtension(file: File): Promise<ImportResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.docx')) return importDocx(file)
  // Best-effort: treat everything else as plain text.
  return importTxt(file)
}
