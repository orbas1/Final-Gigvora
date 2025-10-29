import { ThemeProvider } from './design-system/ThemeProvider'
import HomePage from './components/home/HomePage'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <div className="app">
        <HomePage />
      </div>
    </ThemeProvider>
  )
}

export default App
