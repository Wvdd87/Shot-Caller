import { Icon } from '../common/Icon'

export type PanelId = 'PROJECT' | 'SCENES' | 'IMPORT' | 'EXPORT'

const ITEMS: { id: PanelId; icon: Parameters<typeof Icon>[0]['name']; label: string }[] = [
  { id: 'PROJECT', icon: 'folder', label: 'Project' },
  { id: 'SCENES', icon: 'film', label: 'Scenes' },
  { id: 'IMPORT', icon: 'import', label: 'Import' },
  { id: 'EXPORT', icon: 'export', label: 'Export' },
]

interface Props {
  active: PanelId | null
  onSelect: (id: PanelId) => void
  onSettings: () => void
}

export function IconRail({ active, onSelect, onSettings }: Props) {
  return (
    <nav className="rail">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          className={`rail-btn ${active === item.id ? 'active' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          <Icon name={item.icon} size={16} />
          <span className="rail-lbl">{item.label}</span>
        </button>
      ))}
      <button className="rail-btn rail-settings" onClick={onSettings}>
        <Icon name="settings" size={16} />
        <span className="rail-lbl">Settings</span>
      </button>
    </nav>
  )
}
