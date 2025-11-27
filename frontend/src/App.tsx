import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { LandingPage } from './views/landing'
import { LibraryPage } from './views/library'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/library" element={<LibraryPage />} />
          {/* Future routes */}
          {/* <Route path="/studio/:songId" element={<StudioPage />} /> */}
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
