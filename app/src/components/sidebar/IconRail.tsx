import { Icon } from '../common/Icon'

export type PanelId = 'PROJECT' | 'SCENES' | 'SETTINGS' | 'IMPORT' | 'EXPORT'

const ITEMS: { id: PanelId; icon: Parameters<typeof Icon>[0]['name']; label: string }[] = [
  { id: 'PROJECT', icon: 'folder', label: 'Project' },
  { id: 'SCENES', icon: 'film', label: 'Scenes' },
  { id: 'SETTINGS', icon: 'settings', label: 'Settings' },
  { id: 'IMPORT', icon: 'import', label: 'Import' },
  { id: 'EXPORT', icon: 'export', label: 'Export' },
]

interface Props {
  active: PanelId | null
  onSelect: (id: PanelId) => void
}

export function IconRail({ active, onSelect }: Props) {
  return (
    <nav className="rail">
      {ITEMS.map((item, i) => (
        <button
          key={item.id}
          className={`rail-btn ${active === item.id ? 'active' : ''} ${i === 3 ? 'rail-div' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          <Icon name={item.icon} size={16} />
          <span className="rail-lbl">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
