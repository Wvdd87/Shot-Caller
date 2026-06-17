import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

// Catches render-time crashes so a corrupt project or unexpected error shows a
// recovery screen (and a way to clear local data) instead of a blank page.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[shotcaller] render error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash">
        <div className="crash-inner">
          <div className="crash-mark">!</div>
          <h1>Something went wrong</h1>
          <p>
            Shotcaller hit an unexpected error. Your saved projects are still on disk — you can
            reload, or reset the app if a corrupt project is to blame.
          </p>
          <pre className="crash-detail">{this.state.error.message}</pre>
          <div className="crash-actions">
            <button className="btn primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (confirm('Clear ALL Shotcaller data from this browser? This cannot be undone.')) {
                  Object.keys(localStorage)
                    .filter((k) => k.startsWith('cueflow'))
                    .forEach((k) => localStorage.removeItem(k))
                  window.location.reload()
                }
              }}
            >
              Reset App Data
            </button>
          </div>
        </div>
      </div>
    )
  }
}
