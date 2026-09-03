import { useEffect, useRef, useState } from 'react'

function Terminal({ onOpenResume, onOpenProject, onOpenBlog }) {
  const [content, setContent] = useState(null)
  const [lines, setLines] = useState([])
  const [input, setInput] = useState('')
  const [cwd, setCwd] = useState('~')
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const inputRef = useRef(null)
  const outputRef = useRef(null)

  /*
   * Load portfolio content
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
   * Always keep terminal output scrolled to the bottom
   */
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  /*
   * Terminal prompt
   */
  const getPrompt = () => {
    return `yash@portfolio:${cwd}$ `
  }

  /*
   * Resolve paths like a small Unix shell.
   *
   * Examples:
   *   .
   *   ..
   *   ~/projects
   *   ~/projects/krishi-cobot
   *   meta.json
   *   krishi-cobot
   *   krishi-cobot/meta.json
   */
  const resolvePath = (inputPath) => {
    if (!inputPath || inputPath === '.') {
      return cwd
    }

    let path = inputPath.trim()

    /*
     * Absolute home path
     */
    if (path === '~') {
      return '~'
    }

    if (path.startsWith('~/')) {
      path = path.slice(2)
    } else {
      /*
       * Relative path
       */
      path =
        cwd === '~'
          ? path
          : `${cwd.slice(2)}/${path}`
    }

    const parts = path.split('/').filter(Boolean)
    const normalized = []

    for (const part of parts) {
      if (part === '.') {
        continue
      }

      if (part === '..') {
        if (normalized.length > 0) {
          normalized.pop()
        }

        continue
      }

      normalized.push(part)
    }

    return normalized.length
      ? `~/${normalized.join('/')}`
      : '~'
  }

  /*
   * Build virtual filesystem from content/index.json
   */
  const getFilesystem = () => {
    if (!content) {
      return {}
    }

    const filesystem = {
      '~': {
        type: 'dir',
        children: [
          'about.md',
          'projects',
          'blogs',
          'contact.md',
        ],
      },

      '~/about.md': {
        type: 'file',
      },

      '~/contact.md': {
        type: 'file',
      },

      '~/projects': {
        type: 'dir',
        children: content.projects.length
          ? content.projects.map((project) => project.slug)
          : [],
      },

      '~/blogs': {
        type: 'dir',
        children: content.blogs.length
          ? content.blogs.map((blog) => blog.slug)
          : [],
      },
    }

    /*
     * Project directories
     */
    content.projects.forEach((project) => {
      filesystem[`~/projects/${project.slug}`] = {
        type: 'dir',
        children: ['meta.json'],
      }

      filesystem[`~/projects/${project.slug}/meta.json`] = {
        type: 'file',
      }
    })

    /*
     * Blog directories
     */
    content.blogs.forEach((blog) => {
      filesystem[`~/blogs/${blog.slug}`] = {
        type: 'dir',
        children: ['meta.json'],
      }

      filesystem[`~/blogs/${blog.slug}/meta.json`] = {
        type: 'file',
      }
    })

    return filesystem
  }

  /*
   * Find project/blog by slug
   */
  const findEntry = (slug) => {
    if (!content) {
      return null
    }

    return [
      ...content.projects,
      ...content.blogs,
    ].find((entry) => entry.slug === slug) || null
  }

  /*
   * Find an entry from a full virtual path.
   *
   * Examples:
   *   ~/projects/krishi-cobot
   *   ~/projects/krishi-cobot/meta.json
   */
  const findEntryFromPath = (path) => {
    const match = path.match(
      /^~\/(projects|blogs)\/([^/]+)(?:\/meta\.json)?$/
    )

    if (!match) {
      return null
    }

    const section = match[1]
    const slug = match[2]
    const entry = findEntry(slug)

    if (!entry) {
      return null
    }

    return {
      section,
      slug,
      entry,
    }
  }

  /*
   * Open a project/blog in the Nano viewer
   */
  const openEntry = (path) => {
    const result = findEntryFromPath(path)

    if (!result) {
      return false
    }

    if (result.section === 'projects') {
      if (onOpenProject) {
        onOpenProject(result.entry)
        return true
      }
    }

    if (result.section === 'blogs') {
      if (onOpenBlog) {
        onOpenBlog(result.entry)
        return true
      }
    }

    return false
  }

  /*
   * Static files
   */
  const getStaticFile = (path) => {
    const staticFiles = {
      '~/about.md': [
        {
          type: 'section',
          text: '# Yash Vardhan Kumar',
        },
        {
          type: 'empty',
          text: '',
        },
        {
          type: 'bright',
          text: 'Embedded & Robotics Engineer.',
        },
        {
          type: 'output',
          text: 'I build machines that think and move.',
        },
        {
          type: 'empty',
          text: '',
        },
        {
          type: 'output',
          text: 'Passionate about low-level systems, real-time control,',
        },
        {
          type: 'output',
          text: 'and the intersection of hardware and intelligence.',
        },
        {
          type: 'empty',
          text: '',
        },
      ],

      '~/contact.md': [
        {
          type: 'section',
          text: '── Contact',
        },
        {
          type: 'empty',
          text: '',
        },
        {
          type: 'output',
          text: 'GitHub     →  github.com/yashvardhankumar',
        },
        {
          type: 'output',
          text: 'LinkedIn   →  linkedin.com/in/yashvardhankumar',
        },
        {
          type: 'output',
          text: 'Instagram  →  instagram.com/yashvardhankumar',
        },
        {
          type: 'output',
          text: 'Email      →  yashvardhan.k2004@gmail.com',
        },
        {
          type: 'empty',
          text: '',
        },
      ],
    }

    return staticFiles[path] || null
  }

  /*
   * Run a terminal command
   */
  const runCommand = (command) => {
    const trimmed = command.trim()

    if (!trimmed) {
      return
    }

    const parts = trimmed.split(/\s+/)
    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1)

    const newLines = [
      {
        type: 'command',
        text: `${getPrompt()}${command}`,
      },
    ]

    /*
     * clear
     */
    if (cmd === 'clear') {
      setLines([])
      setInput('')
      setHistoryIndex(-1)
      return
    }

    /*
     * whoami
     */
    if (cmd === 'whoami') {
      newLines.push(
        {
          type: 'output',
          text: 'Yash Vardhan Kumar',
        },
        {
          type: 'output',
          text: 'Embedded Systems / Robotics Engineer',
        },
        {
          type: 'output',
          text: 'ECE · Robotics · ROS 2 · Physical AI',
        },
        {
          type: 'empty',
          text: '',
        },
      )
    }

    /*
     * pwd
     */
    else if (cmd === 'pwd') {
      newLines.push({
        type: 'output',
        text: cwd,
      })
    }

    /*
     * ls
     */
    else if (cmd === 'ls') {
      const filesystem = getFilesystem()
      const current = filesystem[cwd]

      if (!current) {
        newLines.push({
          type: 'error',
          text: `ls: cannot access '${cwd}': No such file or directory`,
        })
      }

      else if (current.type !== 'dir') {
        newLines.push({
          type: 'error',
          text: `ls: ${cwd}: Not a directory`,
        })
      }

      else {
        if (current.children.length === 0) {
          newLines.push({
            type: 'empty',
            text: '',
          })
        } else {
          current.children.forEach((entry) => {
            newLines.push({
              type: 'directory-entry',
              text: entry,
            })
          })

          newLines.push({
            type: 'empty',
            text: '',
          })
        }
      }
    }

    /*
     * cd
     */
    else if (cmd === 'cd') {
      const target = args[0] || '~'
      const path = resolvePath(target)
      const filesystem = getFilesystem()
      const entry = filesystem[path]

      if (!entry) {
        newLines.push({
          type: 'error',
          text: `cd: ${target}: No such file or directory`,
        })
      }

      else if (entry.type !== 'dir') {
        newLines.push({
          type: 'error',
          text: `cd: ${target}: Not a directory`,
        })
      }

      else {
        setCwd(path)
      }
    }

    /*
     * nano
     *
     * Supported:
     *
     * nano krishi-cobot
     * nano ~/projects/krishi-cobot
     * nano meta.json
     * nano ~/projects/krishi-cobot/meta.json
     */
    else if (cmd === 'nano') {
      const target = args[0]

      if (!target) {
        newLines.push({
          type: 'error',
          text: 'nano: missing file operand',
        })
      }

      else {
        const path = resolvePath(target)
        const filesystem = getFilesystem()
        const entry = filesystem[path]

        if (!entry) {
          newLines.push({
            type: 'error',
            text: `nano: ${target}: No such file`,
          })
        }

        /*
         * nano on a project/blog directory
         */
        else if (entry.type === 'dir') {
          const opened = openEntry(path)

          if (!opened) {
            newLines.push({
              type: 'error',
              text: `nano: ${target}: Cannot open`,
            })
          }
        }

        /*
         * nano on meta.json
         */
        else if (path.endsWith('/meta.json')) {
          const opened = openEntry(path)

          if (!opened) {
            newLines.push({
              type: 'error',
              text: `nano: ${target}: Cannot open`,
            })
          }
        }

        /*
         * nano on regular static file
         */
        else if (path === '~/about.md' || path === '~/contact.md') {
          newLines.push({
            type: 'error',
            text: `nano: ${target}: Read-only file`,
          })
        }

        else {
          newLines.push({
            type: 'error',
            text: `nano: ${target}: Cannot open`,
          })
        }
      }
    }

    /*
     * cat
     */
    else if (cmd === 'cat') {
      const target = args[0]

      if (!target) {
        newLines.push({
          type: 'error',
          text: 'cat: missing file operand',
        })
      }

      else {
        const path = resolvePath(target)
        const filesystem = getFilesystem()

        if (!filesystem[path]) {
          newLines.push({
            type: 'error',
            text: `cat: ${target}: No such file`,
          })
        }

        else if (filesystem[path].type === 'dir') {
          newLines.push({
            type: 'error',
            text: `cat: ${target}: Is a directory`,
          })
        }

        else {
          /*
           * Static files
           */
          const staticFile = getStaticFile(path)

          if (staticFile) {
            newLines.push(...staticFile)
          }

          /*
           * Project/blog meta.json
           */
          else if (path.endsWith('/meta.json')) {
            const result = findEntryFromPath(path)

            if (result) {
              newLines.push({
                type: 'output',
                text: JSON.stringify(result.entry, null, 2),
              })

              newLines.push({
                type: 'empty',
                text: '',
              })
            }

            else {
              newLines.push({
                type: 'error',
                text: `cat: ${target}: No such file`,
              })
            }
          }

          else {
            newLines.push({
              type: 'error',
              text: `cat: ${target}: No such file`,
            })
          }
        }
      }
    }

    /*
     * projects
     */
    else if (cmd === 'projects') {
      if (!content) {
        newLines.push({
          type: 'output',
          text: 'Loading projects...',
        })
      }

      else {
        newLines.push({
          type: 'output',
          text: `Projects (${content.projects.length})`,
        })

        if (content.projects.length === 0) {
          newLines.push({
            type: 'output',
            text: 'No projects available.',
          })
        }

        content.projects.forEach((project) => {
          newLines.push({
            type: 'card',
            project,
          })
        })
      }
    }

    /*
     * blogs
     */
    else if (cmd === 'blogs') {
      if (!content) {
        newLines.push({
          type: 'output',
          text: 'Loading blogs...',
        })
      }

      else {
        newLines.push({
          type: 'output',
          text: `Blogs (${content.blogs.length})`,
        })

        if (content.blogs.length === 0) {
          newLines.push({
            type: 'output',
            text: 'No blog posts available.',
          })
        }

        content.blogs.forEach((blog) => {
          newLines.push({
            type: 'card',
            project: blog,
          })
        })
      }
    }

    /*
     * skills
     */
    else if (cmd === 'skills') {
      newLines.push(
        {
          type: 'section',
          text: 'Skills',
        },
        {
          type: 'output',
          text: '────────────────────────────────',
        },
        {
          type: 'output',
          text: 'Languages     Python · C · C++',
        },
        {
          type: 'output',
          text: 'Robotics      ROS 2 · micro-ROS · MAVROS · ArduPilot',
        },
        {
          type: 'output',
          text: 'Embedded      ESP-IDF · FreeRTOS · PlatformIO',
        },
        {
          type: 'output',
          text: 'Simulation    Gazebo · RViz · ArduPilot SITL',
        },
        {
          type: 'output',
          text: 'Tools         Fusion 360 · Buildroot · Git · Linux',
        },
        {
          type: 'empty',
          text: '',
        },
      )
    }

    /*
     * contact
     */
    else if (cmd === 'contact') {
      newLines.push(
        ...(getStaticFile('~/contact.md') || [])
      )
    }

    /*
     * help
     */
    else if (cmd === 'help') {
      newLines.push(
        {
          type: 'output',
          text: 'Available commands:',
        },
        {
          type: 'output',
          text: '  whoami       About me',
        },
        {
          type: 'output',
          text: '  pwd          Show current directory',
        },
        {
          type: 'output',
          text: '  ls           List directory contents',
        },
        {
          type: 'output',
          text: '  cd           Change directory',
        },
        {
          type: 'output',
          text: '  cat          Read a file',
        },
        {
          type: 'output',
          text: '  nano         Open project/blog viewer',
        },
        {
          type: 'output',
          text: '  projects     Browse projects',
        },
        {
          type: 'output',
          text: '  blogs        Browse blog posts',
        },
        {
          type: 'output',
          text: '  skills       Technical skills',
        },
        {
          type: 'output',
          text: '  contact      Contact information',
        },
        {
          type: 'output',
          text: '  help         Show available commands',
        },
        {
          type: 'output',
          text: '  clear        Clear terminal',
        },
        {
          type: 'empty',
          text: '',
        },
      )
    }

    /*
     * Unknown command
     */
    else {
      newLines.push({
        type: 'error',
        text: `${cmd}: command not found`,
      })
    }

    /*
     * Add output
     */
    setLines((prev) => [
      ...prev,
      ...newLines,
    ])

    /*
     * Add command to history
     */
    setHistory((prev) => [
      ...prev,
      trimmed,
    ])

    setHistoryIndex(-1)
    setInput('')
  }

  /*
   * Keyboard handling
   */
  const handleKeyDown = (event) => {
    /*
     * Execute
     */
    if (event.key === 'Enter') {
      event.preventDefault()
      runCommand(input)
      return
    }

    /*
     * Previous command
     */
    if (event.key === 'ArrowUp') {
      event.preventDefault()

      if (!history.length) {
        return
      }

      const nextIndex =
        historyIndex === -1
          ? history.length - 1
          : Math.max(0, historyIndex - 1)

      setHistoryIndex(nextIndex)
      setInput(history[nextIndex])

      return
    }

    /*
     * Next command
     */
    if (event.key === 'ArrowDown') {
      event.preventDefault()

      if (historyIndex === -1) {
        return
      }

      const nextIndex = historyIndex + 1

      if (nextIndex >= history.length) {
        setHistoryIndex(-1)
        setInput('')
      }

      else {
        setHistoryIndex(nextIndex)
        setInput(history[nextIndex])
      }
    }
  }

  /*
   * Command buttons
   */
  const handleCommandButton = (command) => {
    runCommand(command)
    inputRef.current?.focus()
  }

  return (
    <section id="terminal-wrap">

      <div id="term-body">

        <div
          id="output"
          ref={outputRef}
          onClick={() => inputRef.current?.focus()}
        >

           

         

          {lines.map((line, index) => {

            /*
             * Project/blog card
             */
            if (line.type === 'card') {
              const isBlog = content?.blogs?.some(
                (blog) =>
                  blog.slug === line.project.slug
              )

              return (
                <div
                  className="card"
                  key={index}
                  onClick={() => {
                    if (isBlog && onOpenBlog) {
                      onOpenBlog(line.project)
                    }

                    else if (onOpenProject) {
                      onOpenProject(line.project)
                    }
                  }}
                >

                  <div className="card-title">
                    {line.project.title}
                  </div>

                  <div className="card-meta">
                    {(line.project.tags || []).join(' · ')}
                  </div>

                  <div className="card-desc">
                    {line.project.description}
                  </div>

                </div>
              )
            }

            /*
             * Directory entry
             */
            if (line.type === 'directory-entry') {
              return (
                <span
                  className="line"
                  key={index}
                >
                  <span className="dir-entry">
                    {line.text}
                  </span>
                </span>
              )
            }

            /*
             * Normal terminal line
             */
            return (
              <span
                className={`line ${
                  line.type === 'empty'
                    ? 'empty'
                    : ''
                }`}
                key={index}
              >

                <span
                  className={
                    line.type === 'command'
                      ? 'cmd-echo'
                      : line.type === 'error'
                        ? 'output-text error'
                        : line.type === 'section'
                          ? 'section-head'
                          : line.type === 'bright'
                            ? 'output-text bright'
                            : 'output-text'
                  }
                >
                  {line.text}
                </span>

              </span>
            )
          })}

        </div>

      </div>

      <div id="terminal-footer">

        <div id="footer-left">

          <div id="input-row">

            <span id="prompt-label">
              {getPrompt()}
            </span>

            <input
              ref={inputRef}
              id="cmd-input"
              type="text"
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck="false"
              aria-label="Terminal command"
            />

          </div>

          <div id="command-buttons">

            <button
              onClick={() =>
                handleCommandButton('whoami')
              }
            >
              whoami
            </button>

            <button
              onClick={() =>
                handleCommandButton('projects')
              }
            >
              projects
            </button>

            <button
              onClick={() =>
                handleCommandButton('blogs')
              }
            >
              blogs
            </button>

            <button
              onClick={() =>
                handleCommandButton('skills')
              }
            >
              skills
            </button>

            <button
              onClick={() =>
                handleCommandButton('help')
              }
            >
              help
            </button>

            <button
              onClick={() =>
                handleCommandButton('contact')
              }
            >
              contact
            </button>

          </div>

        </div>

        <div id="footer-right">

          <div className="social-btns">

  <a
    className="social-btn"
    href="https://github.com/yashvardhankumar"
    aria-label="GitHub"
    target="_blank"
    rel="noopener noreferrer"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.7-1.6 6.7-7A5.4 5.4 0 0 0 19.3 4 5 5 0 0 0 19.2.8S18 .4 15 2.4a13.4 13.4 0 0 0-7 0C5 0.4 3.8.8 3.8.8A5 5 0 0 0 3.7 4a5.4 5.4 0 0 0-1.4 3.5c0 5.4 3.4 6.6 6.7 7A4.8 4.8 0 0 0 8 18v4" />
      <path d="M8 18c-3.6 1.6-4-1.8-4-1.8" />
    </svg>
  </a>

  <a
    className="social-btn"
    href="https://linkedin.com/in/yashvardhankumar"
    aria-label="LinkedIn"
    target="_blank"
    rel="noopener noreferrer"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" />
      <rect x="2" y="9" width="4" height="12" rx="1" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  </a>

  <a
    className="social-btn"
    href="mailto:yashvardhan.k2004@gmail.com"
    aria-label="Email"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  </a>

</div>

          <button
            className="resume-btn"
            onClick={onOpenResume}
          >
            RESUME
          </button>

        </div>

      </div>

     

    </section>
  )
}

export default Terminal