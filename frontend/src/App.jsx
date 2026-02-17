import { Routes, Route } from 'react-router-dom'
import MainPage from './pages/MainPage'
import DailyPage from './pages/DailyPage'
import StatsPage from './pages/StatsPage'

function App() {
  return (
    <div className="min-w-app min-h-screen bg-dark-bg">
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/daily/:date" element={<DailyPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Routes>
    </div>
  )
}

export default App
