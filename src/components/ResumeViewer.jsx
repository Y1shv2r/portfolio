import { useEffect } from 'react'

function ResumeViewer({ onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const downloadResume = () => {
    const link = document.createElement('a')
    link.href = `${import.meta.env.BASE_URL}resume.pdf`
    link.download = 'Yash-Vardhan-Kumar-Resume.pdf'
    link.click()
  }

  return (
    <div id="resume-overlay" className="active">
      <div className="rv-topbar">
        <span>resume.pdf</span>

        <div className="rv-topbar-right">
          <button
            className="rv-dl-btn"
            onClick={downloadResume}
          >
            DOWNLOAD
          </button>

          <button
            className="rv-close-btn"
            onClick={onClose}
          >
            ESC · CLOSE
          </button>
        </div>
      </div>

      <div className="rv-body">
        <iframe
          className="rv-img"
          src={`${import.meta.env.BASE_URL}resume.pdf`}
          title="Yash Vardhan Kumar Resume"
        />
      </div>
    </div>
  )
}

export default ResumeViewer