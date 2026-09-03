import { useState } from 'react'
import Hero from './components/Hero'
import Terminal from './components/Terminal'
import NanoViewer from './components/NanoViewer'
import ResumeViewer from './components/ResumeViewer'

import './App.css'
import './index.css'
import './blocks.css'
import './terminal.css'

function App() {
  const [activeEntry, setActiveEntry] = useState(null)
  const [resumeOpen, setResumeOpen] = useState(false)

  return (
    <>
      <Hero />

      <Terminal
        onOpenResume={() => setResumeOpen(true)}
        onOpenProject={(project) => setActiveEntry(project)}
        onOpenBlog={(blog) => setActiveEntry(blog)}
      />

      {resumeOpen && (
        <ResumeViewer
          onClose={() => setResumeOpen(false)}
        />
      )}

      {activeEntry && (
        <NanoViewer
          entry={activeEntry}
          onClose={() => setActiveEntry(null)}
        />
      )}
    </>
  )
}

export default App