# Portfolio Content Guide

Everything you need to add projects and blogs. No code, no backend, no database.

---

## How it works

```
your-repo/
├── content/
│   ├── index.json          ← auto-generated, don't edit manually
│   ├── projects/
│   │   ├── robot-arm/
│   │   │   ├── meta.json   ← YOU write this
│   │   │   ├── photo.jpg   ← YOU drop files here
│   │   │   └── demo.mp4
│   │   └── my-new-project/ ← just create a folder
│   │       ├── meta.json
│   │       └── ...
│   └── blogs/
│       └── my-new-blog/
│           ├── meta.json
│           └── ...
├── build-index.js          ← run once locally OR let GitHub Actions do it
└── .github/workflows/
    └── build-index.yml     ← auto-runs on every push
```

When you push to GitHub, the Action automatically runs `build-index.js`, which scans all your `meta.json` files and writes `content/index.json`. Your portfolio frontend fetches that file on load.

---

## Adding a new project or blog

**Step 1 — Create a folder**

```
content/projects/my-cool-robot/
```
or
```
content/blogs/my-uart-post/
```

The folder name becomes the URL slug (e.g. `nano my-cool-robot` in the terminal). Use lowercase, hyphens only, no spaces.

**Step 2 — Drop in your media**

Just copy your files into the folder. Supported:
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Videos: `.mp4`, `.webm`
- Docs: `.pdf`, `.md`, any file you want linked

**Step 3 — Write `meta.json`**

This is the only thing you write. See the full reference below.

**Step 4 — Push to GitHub**

That's it. The GitHub Action rebuilds `content/index.json` automatically.

---

## meta.json — Full Reference

```jsonc
{
  "title":       "My Project Name",         // shown as heading
  "startDate":   "2025-06",                 // YYYY-MM, when work began
  "endDate":     "",                        // YYYY-MM, or "" if still ongoing
  "tags":        ["Embedded", "C++"],       // shown as chips
  "description": "One sentence summary.",   // shown on cards in the terminal

  "blocks": [
    // Blocks are rendered IN ORDER — mix and match freely.
    // Every project/blog is just an ordered list of blocks.
  ]
}
```

Sorting: ongoing entries (no `endDate`) always sort first, as the most current
work. Among finished entries, the most recent `endDate` sorts first. Display
on the site shows as `Feb 2025 – Sep 2025` or `Feb 2025 – Ongoing`.

---

## Block Types

### Text
```json
{
  "type": "text",
  "content": "Write anything here. Explain your approach, describe the problem, share results. As long as you want."
}
```
No limit on length. Each text block renders as a paragraph.

---

### Image
```json
{
  "type": "image",
  "src": "photo.jpg",
  "caption": "Optional caption shown below the image."
}
```
`src` is the filename relative to the same folder as `meta.json`.
`caption` is optional — just remove the line if you don't need it.

---

### Video
```json
{
  "type": "video",
  "src": "demo.mp4",
  "caption": "Optional caption."
}
```
Same rules as image. The video gets a native HTML5 player with controls.

---

### Document / PDF
```json
{
  "type": "doc",
  "src": "datasheet.pdf",
  "caption": "Motor driver datasheet"
}
```
Renders as a clickable link card that opens the file in a new tab.

---

## Full example — project with everything

```json
{
  "title": "6-DOF Robotic Arm",
  "startDate": "2025-02",
  "endDate": "2025-06",
  "tags": ["Robotics", "C++", "ROS2", "IK"],
  "description": "A 6-DOF arm with inverse kinematics and a custom BLDC controller.",
  "blocks": [
    {
      "type": "text",
      "content": "Built from scratch using ROS2. The challenge was designing a reliable IK solver that could handle singularities near the workspace boundary."
    },
    {
      "type": "image",
      "src": "arm-overview.jpg",
      "caption": "Full arm at max reach — 80cm from base to tip"
    },
    {
      "type": "text",
      "content": "The motor controller uses a custom PCB with an STM32G4 running field-oriented control at 20kHz. CAN bus connects all 6 joints to the main computer."
    },
    {
      "type": "video",
      "src": "pick-place.mp4",
      "caption": "Pick and place at 0.5kg payload"
    },
    {
      "type": "image",
      "src": "pcb-top.jpg",
      "caption": "Motor driver PCB — 4-layer, 50x50mm"
    },
    {
      "type": "doc",
      "src": "motor-driver-schematic.pdf",
      "caption": "Full schematic PDF"
    },
    {
      "type": "text",
      "content": "Next steps: add force feedback to the gripper fingers using strain gauges and close the force loop in software."
    }
  ]
}
```

---

## Full example — text-only blog (no images needed)

```json
{
  "title": "UART Deep Dive",
  "startDate": "2025-01",
  "endDate": "",
  "tags": ["Embedded", "Protocols"],
  "description": "Everything about UART — framing, baud rate errors, DMA, and debugging tips.",
  "blocks": [
    {
      "type": "text",
      "content": "UART is the simplest serial protocol. Start bit → 8 data bits → optional parity → stop bit."
    },
    {
      "type": "text",
      "content": "Baud rate mismatch above 2-3% causes framing errors. Always verify with a logic analyzer."
    },
    {
      "type": "text",
      "content": "DMA-based UART: offload transfers to DMA, CPU stays free for real work. Overrun errors? Your ISR is too slow."
    }
  ]
}
```

No image? No problem. Just don't add image blocks.

---

## Rules & tips

| Rule | Detail |
|------|--------|
| Folder name = slug | `my-cool-robot` → accessible as `nano my-cool-robot` in terminal |
| Files sit next to `meta.json` | `"src": "photo.jpg"` means `content/projects/my-cool-robot/photo.jpg` |
| Order matters | Blocks render top to bottom exactly as written |
| All fields except `blocks` items of type `text` are optional per block | `caption` is never required |
| Sorting is by `endDate` (ongoing first) | Format `YYYY-MM`, ties broken by `startDate` |
| Push = publish | GitHub Action auto-rebuilds index on every push to `main` |

---

## Running the build locally (optional)

If you want to test before pushing:

```bash
node build-index.js
```

Requires Node.js (any version ≥ 14). No npm install needed — the script uses only built-in modules.

---

## Adding the `<link>` for blocks.css

In your `Portfolio.html`, add this line inside `<head>` alongside your existing styles:

```html
<link rel="stylesheet" href="blocks.css">
```

---

## GitHub Pages setup (one-time)

1. Push this whole repo to GitHub
2. Go to **Settings → Pages**
3. Set source to **Deploy from a branch → main → / (root)**
4. Done — your site is live at `https://yourusername.github.io/repo-name/`

The GitHub Action needs write permission. Go to **Settings → Actions → General → Workflow permissions** and set it to **Read and write permissions**.
