import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { LandingPage } from './views/landing'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          {/* Future routes */}
          {/* <Route path="/library" element={<LibraryPage />} /> */}
          {/* <Route path="/studio/:songId" element={<StudioPage />} /> */}
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
