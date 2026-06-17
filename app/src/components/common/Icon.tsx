// Minimal stroked-line icon set (Lucide-style paths). All use currentColor.
import type { JSX } from 'react'

type Name =
  | 'folder' | 'film' | 'settings' | 'import' | 'export' | 'plus' | 'x'
  | 'close' | 'chevron-down' | 'chevron-right' | 'search' | 'menu' | 'play'
  | 'undo' | 'redo' | 'bold' | 'italic' | 'underline' | 'trash' | 'edit'
  | 'pause' | 'grip' | 'check' | 'arrow-up' | 'arrow-down' | 'keyboard'
  | 'eye' | 'target' | 'upload' | 'download' | 'camera' | 'copy' | 'alert'

const paths: Record<Name, JSX.Element> = {
  folder: <path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />,
  film: <><rect x="3" y="4" width="18" height="16" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  import: <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />,
  export: <path d="M12 21V9m0 0l-4 4m4-4l4 4M4 3h16" />,
  upload: <path d="M12 19V7m0 0l-4 4m4-4l4 4M5 21h14" />,
  download: <path d="M12 5v12m0 0l-4-4m4 4l4-4M5 21h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  play: <path d="M7 4l13 8-13 8z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  undo: <path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />,
  redo: <path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />,
  bold: <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />,
  italic: <path d="M19 5h-6M11 19H5M15 5L9 19" />,
  underline: <path d="M7 4v6a5 5 0 0 0 10 0V4M5 20h14" />,
  trash: <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />,
  edit: <path d="M4 20h4l10-10-4-4L4 16zM13.5 6.5l4 4" />,
  grip: <path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" />,
  check: <path d="M5 12l5 5L20 6" />,
  'arrow-up': <path d="M12 19V5m0 0l-6 6m6-6l6 6" />,
  'arrow-down': <path d="M12 5v14m0 0l6-6m-6 6l-6-6" />,
  keyboard: <><rect x="3" y="6" width="18" height="12" /><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  camera: <><path d="M3 8a1 1 0 0 1 1-1h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><circle cx="12" cy="13" r="3.5" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" /><path d="M5 15V5a1 1 0 0 1 1-1h9" /></>,
  alert: <><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>,
}

export function Icon({ name, size = 16, className }: { name: Name; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
