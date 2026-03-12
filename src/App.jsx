import { Routes, Route } from 'react-router-dom'
import MainPage from './pages/MainPage'
import DailyPage from './pages/DailyPage'
import LeaderboardPage from './pages/LeaderboardPage'

function App() {
  return (
    <div className="min-w-app min-h-screen bg-dark-bg">
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/daily/:date" element={<DailyPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Routes>
    </div>
  )
}

export default App
