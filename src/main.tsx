import './utils/timezone';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { MotionProvider } from './components/ui/motion'
import { registerServiceWorker } from './utils/pwa'
import { AppErrorBoundary } from './components/AppErrorBoundary'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <MotionProvider>
          <App />
        </MotionProvider>
      </AuthProvider>
    </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
)
