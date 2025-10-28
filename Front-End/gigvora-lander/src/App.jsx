import { ThemeProvider } from './design-system/ThemeProvider'
import { ToasterProvider } from './components/feedback/Toaster'
import { ModalProvider } from './components/overlays/ModalRoot'
import AppShell from './components/layout/AppShell'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <ToasterProvider>
        <ModalProvider>
          <AppShell />
        </ModalProvider>
      </ToasterProvider>
    </ThemeProvider>
  )
}

export default App
