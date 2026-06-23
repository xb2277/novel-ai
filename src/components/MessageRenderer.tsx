import { useMemo } from 'react'

// ===== Structured message rendering (replaces dangerouslySetInnerHTML) =====

interface ParsedSegment {
  type: 'label' | 'text'
  content: string
}

/**
 * Parse a message that may contain **【标签】** markers into structured segments.
 * Labels are rendered as colored badges; everything else is plain text.
 */
function parseMessage(content: string): ParsedSegment[] {
  const segments: ParsedSegment[] = []
  // Split on **【...】** pattern
  const regex = /\*\*【(.+?)】\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    // Text before the label
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim()
      if (text) segments.push({ type: 'text', content: text })
    }
    // The label itself
    segments.push({ type: 'label', content: match[1] })
    lastIndex = regex.lastIndex
  }

  // Remaining text after last label
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim()
    if (text) segments.push({ type: 'text', content: text })
  }

  // If no labels found, treat entire content as text
  if (segments.length === 0) {
    segments.push({ type: 'text', content })
  }

  return segments
}

const LABEL_COLORS: Record<string, string> = {
  '力度版': '#c2410c',
  '情绪版': '#1d4ed8',
  '简洁版': '#15803d',
  '润色建议': '#6d28d9',
  '续写灵感': '#db2777',
  '一致性提醒': '#0891b2',
}

function labelColor(label: string): string {
  return LABEL_COLORS[label] || '#4b5563'
}

export default function MessageRenderer({ content }: { content: string }) {
  const segments = useMemo(() => parseMessage(content), [content])

  return (
    <span className="whitespace-pre-wrap">
      {segments.map((seg, i) => {
        if (seg.type === 'label') {
          const color = labelColor(seg.content)
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 500,
                padding: '1px 6px',
                borderRadius: 999,
                background: `${color}15`,
                color,
                marginBottom: 4,
              }}
            >
              {seg.content}
            </span>
          )
        }
        return <span key={i}>{seg.content}</span>
      })}
    </span>
  )
}
