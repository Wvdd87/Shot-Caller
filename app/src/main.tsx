import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProvider } from './state/context'
import { App } from './App'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import './styles/tokens.css'
import './styles/components.css'
import './styles/app.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
