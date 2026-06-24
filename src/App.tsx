import { useState, useEffect } from 'react'
import { useStore } from './stores/useStore'
import Editor from './components/Editor'
import AiChatDialog from './components/AiChatDialog'
import SettingsMenu from './components/SettingsMenu'
import LeftSidebar from './components/LeftSidebar'
import NovelSwitcher from './components/NovelSwitcher'
import { MenuIcon, SettingsIcon, PanelIcon } from './components/icons'

export default function App() {
  const { sidePanelOpen, toggleSidePanel, leftPanelOpen, toggleLeftPanel } = useStore()
  const settings = useStore((s) => s.settings)
  const [showSettings, setShowSettings] = useState(false)

  // Apply saved background color on mount
  useEffect(() => {
    document.body.style.backgroundColor = settings.bgColor
  }, [settings.bgColor])

  return (
    <div className="h-screen flex flex-col font-ui">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLeftPanel}
            className={`p-1 rounded hover:bg-[var(--color-accent-light)]/50 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors ${
              leftPanelOpen ? 'text-[var(--color-accent)] bg-[var(--color-accent-light)]/50' : ''
            }`}
            title="切换侧栏"
          >
            <MenuIcon size={16} />
          </button>
          <span className="text-sm font-medium tracking-wide flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />
            </svg>
            笔灵
          </span>
          <span className="text-[11px] text-[var(--color-text-secondary)] hidden sm:inline">
            AI 写作灵感助手
          </span>
        </div>
        <div className="flex items-center gap-1 relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`btn-ghost text-xs ${showSettings ? '!bg-[var(--color-accent-light)] !text-[var(--color-accent)]' : ''}`}
          >
            <SettingsIcon size={14} />
            <span className="hidden sm:inline">设置</span>
          </button>
          {showSettings && <SettingsMenu onClose={() => setShowSettings(false)} />}
          <NovelSwitcher />
          <button
            onClick={toggleSidePanel}
            className={`btn-ghost text-xs ${sidePanelOpen ? '!bg-[var(--color-accent-light)] !text-[var(--color-accent)]' : ''}`}
          >
            <PanelIcon size={14} />
            <span className="hidden sm:inline">AI 面板</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside
          className={`shrink-0 border-r border-[var(--color-border)] transition-all duration-200 overflow-hidden ${
            leftPanelOpen ? 'w-[260px]' : 'w-0 border-r-0'
          }`}
          style={{ minWidth: leftPanelOpen ? '260px' : '0' }}
        >
          <LeftSidebar />
        </aside>

        <main
          className={`flex-1 min-w-0 transition-all duration-200 ${
            sidePanelOpen ? 'mr-[360px]' : ''
          }`}
        >
          <Editor />
        </main>

        <aside
          className={`fixed right-0 top-[42px] bottom-0 w-[360px] bg-[var(--color-surface)] border-l border-[var(--color-border)] transition-transform duration-200 ${
            sidePanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <AiChatDialog />
        </aside>
      </div>

    </div>
  )
}
