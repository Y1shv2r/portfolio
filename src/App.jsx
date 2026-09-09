import { useEffect, useState } from 'react'
import Hero from './components/Hero'
import Terminal from './components/Terminal'
import NanoViewer from './components/NanoViewer'
import ResumeViewer from './components/ResumeViewer'

import './App.css'
import './index.css'
import './blocks.css'
import './terminal.css'

function getEntryFromPath(content, pathname) {
  const match = pathname.match(/^\/(projects|blogs)\/([^/]+)\/?$/)

  if (!match || !content) {
    return null
  }

  const section = match[1]
  const slug = match[2]

  const entries = section === 'projects'
    ? content.projects || []
    : content.blogs || []

  const entry = entries.find((item) => item.slug === slug)

  return entry || null
}

function App() {
  const [content, setContent] = useState(null)
  const [activeEntry, setActiveEntry] = useState(null)
  const [resumeOpen, setResumeOpen] = useState(false)

  /*
   * Load portfolio content.
   */
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}content/index.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load content')
        }

        return response.json()
      })
      .then((data) => {
        setContent(data)
      })
      .catch((error) => {
        console.error(error)
      })
  }, [])

  /*
   * Restore a URL that came through GitHub Pages 404.html.
   */
  useEffect(() => {
    const redirectPath = sessionStorage.getItem('spaRedirect')

    if (redirectPath) {
      sessionStorage.removeItem('spaRedirect')

      window.history.replaceState(
        {},
        '',
        redirectPath
      )
    }
  }, [])

  /*
   * Open an entry if the current URL points to one.
   */
  useEffect(() => {
    if (!content) {
      return
    }

    const entry = getEntryFromPath(
      content,
      window.location.pathname
    )

    setActiveEntry(entry)
  }, [content])

  /*
   * Browser back/forward support.
   */
  useEffect(() => {
    const handlePopState = () => {
      if (!content) {
        return
      }

      const entry = getEntryFromPath(
        content,
        window.location.pathname
      )

      setActiveEntry(entry)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [content])

  /*
   * Open a project/blog and update the browser URL.
   */
  const openEntry = (entry) => {
    if (!entry) {
      return
    }

    const path = `/${entry.section}/${entry.slug}`

    window.history.pushState(
      {},
      '',
      path
    )

    setActiveEntry(entry)
  }

  /*
   * Close Nano and return to the main terminal URL.
   */
  const closeEntry = () => {
    const isEntryUrl =
      /^\/(projects|blogs)\/[^/]+\/?$/.test(
        window.location.pathname
      )

    if (isEntryUrl) {
      window.history.back()
    } else {
      setActiveEntry(null)
    }
  }

  return (
    <>
      <Hero />

      <Terminal
        onOpenResume={() => setResumeOpen(true)}
        onOpenProject={openEntry}
        onOpenBlog={openEntry}
      />

      {resumeOpen && (
        <ResumeViewer
          onClose={() => setResumeOpen(false)}
        />
      )}

      {activeEntry && (
        <NanoViewer
          entry={activeEntry}
          onClose={closeEntry}
        />
      )}
    </>
  )
}

export default App