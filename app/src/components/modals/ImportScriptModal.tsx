import { useRef, useState } from 'react'
import { useApp } from '../../state/context'
import { importByExtension, importPaste, type ImportResult } from '../../lib/scriptImport'
import { detectCharacters, htmlToPlainText } from '../../lib/script'
import { Icon } from '../common/Icon'

type Step = 'method' | 'preview' | 'characters'

export function ImportScriptModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp()
  const [step, setStep] = useState<Step>('method')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [detected, setDetected] = useState<string[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const sceneId = state.activeSceneId

  const proceedToPreview = (res: ImportResult) => {
    setResult(res)
    const plain = htmlToPlainText(res.html)
    const chars = detectCharacters(plain, res.html).slice(0, 24)
    setDetected(chars)
    setPicked(new Set(chars))
    setStep('preview')
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const res = await importByExtension(file)
      proceedToPreview(res)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  const usePaste = () => {
    if (!pasteText.trim()) return
    proceedToPreview(importPaste(pasteText))
  }

  const finish = () => {
    if (!result || !sceneId) return
    dispatch({ type: 'UPDATE_SCRIPT_HTML', sceneId, html: result.html })
    // Add picked character names to vocabulary (as CHARACTER terms), de-duped.
    const existing = new Set(
      (state.project?.settings.shotVocabulary || []).map((v) => v.text.toUpperCase()),
    )
    picked.forEach((name) => {
      const t = name.toUpperCase()
      if (!existing.has(t)) dispatch({ type: 'ADD_VOCAB', text: t, category: 'CHARACTER' })
    })
    onClose()
  }

  const toggle = (name: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const plainPreview = result ? htmlToPlainText(result.html) : ''

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="eyebrow">Import Script · Step {step === 'method' ? '1' : step === 'preview' ? '2' : '3'} / 3</div>
            <h3>
              {step === 'method' && 'Choose a source'}
              {step === 'preview' && 'Preview'}
              {step === 'characters' && 'Detected characters'}
            </h3>
          </div>
          <button className="close" onClick={onClose}>
            <Icon name="x" size={12} />
          </button>
        </div>

        <div className="modal-body">
          {step === 'method' && (
            <>
              <div className="import-methods">
                <button className="import-method" onClick={() => fileRef.current?.click()} disabled={busy}>
                  <Icon name="upload" size={18} />
                  <span className="im-name">Upload .docx</span>
                  <span className="im-desc">Word document, formatting preserved</span>
                </button>
                <button className="import-method" onClick={() => fileRef.current?.click()} disabled={busy}>
                  <Icon name="film" size={18} />
                  <span className="im-name">Upload .txt</span>
                  <span className="im-desc">Plain text file</span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".docx,.txt,text/plain" hidden onChange={onFile} />

              <div className="import-paste">
                <div className="section-eyebrow">Or paste text</div>
                <div className="input area" style={{ height: 180 }}>
                  <textarea
                    placeholder="Paste your script here…"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    style={{ height: '100%' }}
                  />
                </div>
              </div>
            </>
          )}

          {step === 'preview' && result && (
            <>
              <p className="import-source mono">
                <Icon name="check" size={13} /> {result.sourceName} · {plainPreview.length.toLocaleString()} chars
              </p>
              <div className="import-preview">{plainPreview.slice(0, 4000) || '(empty)'}</div>
            </>
          )}

          {step === 'characters' && (
            <>
              <p>
                {detected.length
                  ? 'These ALL-CAPS names look like characters. Add them to your vocabulary for quick shot labelling.'
                  : 'No characters were auto-detected — you can add them later in Settings → Vocab.'}
              </p>
              <div className="char-grid">
                {detected.map((name) => (
                  <button
                    key={name}
                    className={`char-chip ${picked.has(name) ? 'on' : ''}`}
                    onClick={() => toggle(name)}
                  >
                    {picked.has(name) && <Icon name="check" size={11} />} {name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          {step === 'method' && (
            <>
              <button className="btn ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn primary" disabled={!pasteText.trim()} onClick={usePaste}>
                Use pasted text
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button className="btn ghost" onClick={() => setStep('method')}>
                Back
              </button>
              <button className="btn primary" onClick={() => setStep('characters')}>
                Continue
              </button>
            </>
          )}
          {step === 'characters' && (
            <>
              <button className="btn ghost" onClick={() => setStep('preview')}>
                Back
              </button>
              <button className="btn primary" onClick={finish}>
                Import Script
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
