import { useState, useEffect, useRef } from 'react'
import { useStore, BG_COLOR_PRESETS } from '../stores/useStore'
import { ChevronIcon, EyeIcon, EyeOffIcon } from './icons'

const PRESET_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'deepseek-chat', label: 'DeepSeek V3' },
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { value: 'qwen-turbo', label: '通义千问 Turbo' },
]

const BASE_URL_PRESETS = [
  { value: 'https://api.openai.com/v1', label: 'OpenAI' },
  { value: 'https://api.deepseek.com/v1', label: 'DeepSeek' },
  { value: 'https://dashscope.aliyuncs.com/compatible-mode/v1', label: '通义千问' },
]

export default function SettingsMenu({ onClose }: { onClose: () => void }) {
  const { settings, setSettings } = useStore()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [apiExpanded, setApiExpanded] = useState(false)
  const [localSettings, setLocalSettings] = useState({ ...settings })
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Apply background color to body (no cleanup — App.tsx handles persistence)
  useEffect(() => {
    document.body.style.backgroundColor = settings.bgColor
  }, [settings.bgColor])

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleSaveApi = () => {
    setSettings(localSettings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleBgColor = (color: string) => {
    setSettings({ bgColor: color })
    document.body.style.backgroundColor = color
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        ref={menuRef}
        className="absolute top-10 right-4 w-72 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-lg font-ui"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 背景颜色 */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--color-bg)] transition-colors rounded-t-xl"
          onClick={() => setExpanded(expanded === 'bg' ? null : 'bg')}
        >
          <span className="text-sm font-medium">背景颜色</span>
          <span className="flex items-center gap-2">
            <span
              className="w-4 h-4 rounded-full border border-[var(--color-border)] shrink-0"
              style={{ backgroundColor: settings.bgColor }}
            />
            <ChevronIcon expanded={expanded === 'bg'} />
          </span>
        </div>
        {expanded === 'bg' && (
          <div className="px-4 pb-3 flex gap-2">
            {BG_COLOR_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => handleBgColor(p.value)}
                className="flex flex-col items-center gap-1 group"
                title={p.label}
              >
                <span
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: p.value,
                    borderColor: settings.bgColor === p.value
                      ? 'var(--color-accent)'
                      : 'var(--color-border)',
                  }}
                />
                <span className="text-[10px] text-[var(--color-text-secondary)]">{p.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-[var(--color-border)]" />

        {/* API 设置 */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--color-bg)] transition-colors"
          onClick={() => setApiExpanded(!apiExpanded)}
        >
          <span className="text-sm font-medium">API 设置</span>
          <span className="text-xs text-[var(--color-text-secondary)]">
            {settings.apiKey ? '已配置' : '未配置'}
          </span>
          <ChevronIcon expanded={apiExpanded} />
        </div>

        {apiExpanded && (
          <div className="px-4 pb-3 space-y-3">
            {/* 服务商 */}
            <div className="flex flex-wrap gap-1.5">
              {BASE_URL_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setLocalSettings((s) => ({ ...s, apiBaseUrl: p.value }))}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                    localSettings.apiBaseUrl === p.value
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Base URL */}
            <input
              type="text"
              value={localSettings.apiBaseUrl}
              onChange={(e) => setLocalSettings((s) => ({ ...s, apiBaseUrl: e.target.value }))}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]"
              placeholder="https://api.deepseek.com/v1"
            />

            {/* API Key */}
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={localSettings.apiKey}
                onChange={(e) => setLocalSettings((s) => ({ ...s, apiKey: e.target.value }))}
                className="w-full text-xs px-3 py-2 pr-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]"
                placeholder="sk-..."
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                {showKey ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
              </button>
            </div>

            {/* 模型 */}
            <select
              value={localSettings.model}
              onChange={(e) => setLocalSettings((s) => ({ ...s, model: e.target.value }))}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              {PRESET_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            {/* 保存按钮 */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-[var(--color-text-secondary)]">Key 仅保存在本地</span>
              <button onClick={handleSaveApi} className="btn-primary text-xs py-1.5 px-3">
                {saved ? '已保存' : '保存'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
