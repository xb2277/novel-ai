import type { Settings, Suggestion, ChatMessage } from '../stores/useStore'
import { v4 as uuidv4 } from 'uuid'

// ===== Shared API caller =====
// Calls the AI provider's OpenAI-compatible API directly from the browser.
// Most providers (OpenAI, DeepSeek, Qwen) support CORS for /chat/completions.

async function callAI(
  settings: Settings,
  messages: { role: string; content: string }[],
  temperature = 0.8,
  maxTokens = 1500
): Promise<string> {
  const url = `${settings.apiBaseUrl}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  let data: any
  try {
    data = await res.json()
  } catch {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}: empty response`)
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `API call failed (${res.status})`
    throw new Error(msg)
  }

  return data.choices?.[0]?.message?.content ?? ''
}

// ===== Suggestions =====

const SYSTEM_PROMPT = `你是一位专业的网络小说写作助手。你的任务是对用户提供的句子，从多个角度给出改写建议。

规则：
1. 给出恰好3种不同的表达方式
2. 每种表达用不同的角度：力度版（更有冲击力）、情绪版（更细腻的情感描写）、简洁版（更精炼）
3. 保持原文的核心意思不变
4. 直接输出改写结果，不要解释、不要序号、不要前缀
5. 三种表达之间用 "---" 分隔
6. 每种表达控制在1-3句话`

function parseSuggestions(content: string) {
  const labels = ['力度版', '情绪版', '简洁版']
  const parts = content.split('---').map((s) => s.trim()).filter(Boolean)

  return parts.map((text, i) => ({
    label: labels[i] || `方案${i + 1}`,
    text: text.replace(/^[\d\.\、\s]+/, '').replace(/^["「]|["」]$/g, ''),
  }))
}

export async function generateSuggestions(
  settings: Settings,
  selectedText: string
): Promise<Suggestion[]> {
  if (!settings.apiKey) {
    throw new Error('请先配置 API Key')
  }

  if (!selectedText.trim()) {
    throw new Error('请先选中一段文字')
  }

  const content = await callAI(
    settings,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `请为以下句子提供3种不同的改写建议：\n\n"${selectedText}"` },
    ],
    0.9,
    800
  )

  const raws = parseSuggestions(content)
  return raws.map((r) => ({ id: uuidv4(), ...r }))
}

export async function generateMockSuggestions(selectedText: string): Promise<Suggestion[]> {
  await new Promise((r) => setTimeout(r, 800))

  const text = selectedText.trim()
  const snippet = text.length > 20 ? text.slice(0, 20) + '\u2026' : text

  return [
    {
      id: uuidv4(),
      label: '力度版',
      text: `\u3010力度版 - 基于\u300c${snippet}\u300d\u3011每个字都像铁锤砸在纸上。改写后的句子筋骨毕露，删去所有虚词，让动词和名词正面碰撞，产生一种无可回避的冲击力。`,
    },
    {
      id: uuidv4(),
      label: '情绪版',
      text: `\u3010情绪版 - 基于\u300c${snippet}\u300d\u3011往文字里注入了温度。把动作背后的情绪拉成慢镜头\u2014\u2014这一刻他在想什么、怕什么、渴望什么\u2014\u2014让读者不是"看到"而是在"感受"。`,
    },
    {
      id: uuidv4(),
      label: '简洁版',
      text: `\u3010简洁版 - 基于\u300c${snippet}\u300d\u3011一刀削去所有枝蔓。保留核心动作和意象，其余全部拿掉。像俳句，留白本身就是表达。`,
    },
  ]
}

// ===== Real-time Observation =====

const OBSERVE_SYSTEM_PROMPT = `你是一位专业的网络小说写作助手，正在实时观察作者的写作过程。

你的任务：根据作者当前正在写的内容，给出3个角度的建议。

规则：
1. 恰好3条建议，按以下顺序，用 "---" 分隔：
   - 润色建议：对最近写的一段话有没有更好的表达方式（更生动、更有画面感）
   - 续写灵感：基于上下文逻辑，接下来可以写什么（1-2个方向，简短）
   - 一致性提醒：有没有和前面内容矛盾的地方，或者节奏上有问题
2. 每条控制在1-3句话，直接说重点，不要客套
3. 润色建议里如果原文本身已经很好，就说"当前表达很到位"并简单肯定
4. 如果没有明显的一致性问题，一致性提醒简单说"暂未发现矛盾"
5. 不要输出编号、前缀、解释性的废话`

export interface Observation {
  label: string
  text: string
}

function parseObservations(content: string): Observation[] {
  const labels = ['润色建议', '续写灵感', '一致性提醒']
  const parts = content.split('---').map((s) => s.trim()).filter(Boolean)

  return parts.map((text, i) => ({
    label: labels[i] || `建议${i + 1}`,
    text: text.replace(/^[\d\.\、\s]+/, '').replace(/^["「]|["」]$/g, ''),
  }))
}

export async function generateObservation(
  settings: Settings,
  chapterContent: string
): Promise<Observation[]> {
  if (!settings.apiKey) {
    throw new Error('请先配置 API Key')
  }

  // Strip HTML to get plain text for the AI
  const plainText = chapterContent
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()

  if (plainText.length < 20) {
    throw new Error('内容太短，多写一点再观察')
  }

  // Send the last ~2000 chars so the AI sees recent context
  const context = plainText.length > 2000
    ? plainText.slice(-2000)
    : plainText

  const content = await callAI(
    settings,
    [
      { role: 'system', content: OBSERVE_SYSTEM_PROMPT },
      { role: 'user', content: `我正在写小说，以下是我当前章节的内容。请观察后给出建议：\n\n${context}` },
    ],
    0.7,
    800
  )

  return parseObservations(content)
}

export async function generateMockObservation(chapterContent: string): Promise<Observation[]> {
  await new Promise((r) => setTimeout(r, 1200))

  const plainText = chapterContent.replace(/<[^>]*>/g, '').trim()
  const lastSentences = plainText.slice(-50).replace(/\n/g, ' ')

  return [
    {
      label: '润色建议',
      text: `读到「${lastSentences.slice(0, 30)}…」这段，画面感已经有了。试试在关键动作上多加一个感官细节——声音、气味、或触感——能让人物更立体。`,
    },
    {
      label: '续写灵感',
      text: '顺着当前的情绪流，一个自然的下一步是：引入一个新的选择或阻碍，让角色必须在两个方向中做出抉择。冲突和悬念可以来自外部（环境/他人）也可以来自内部（恐惧/欲望）。',
    },
    {
      label: '一致性提醒',
      text: '暂未发现明显矛盾。如果你已经在作品中建立了具体的角色性格或世界观设定，可以回头看当前人物的行为是否始终符合他的动机。',
    },
  ]
}

// ===== Chat / Conversation =====

const CHAT_SYSTEM_PROMPT = `你是一位专业的网络小说写作助手，笔名"笔灵"。你可以帮助作者：
- 讨论剧情走向、人物塑造、世界观设定
- 提供写作灵感和创意建议
- 解答写作过程中遇到的困惑
- 优化段落表达和节奏把控

请用中文回复，保持专业、热情、有洞察力的风格。回复简洁有力，不要过度冗长。`

export async function sendChatMessage(
  settings: Settings,
  messages: ChatMessage[],
  newMessage: string
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error('请先配置 API Key')
  }

  const chatMessages = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: newMessage },
  ]

  return callAI(settings, chatMessages, 0.8, 1500)
}

export async function sendMockChatMessage(newMessage: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 1000))

  const responses: Record<string, string> = {
    '\u5927\u7eb2': '\u5173\u4e8e\u5927\u7eb2\uff0c\u6211\u7684\u5efa\u8bae\u662f\u5148\u786e\u5b9a\u6545\u4e8b\u7684\u6838\u5fc3\u51b2\u7a81\u548c\u4e3b\u7ebf\u3002\u4e00\u4e2a\u597d\u7684\u5927\u7eb2\u5e94\u8be5\u5305\u542b\uff1a\n\n1. **\u6838\u5fc3\u77db\u76fe** \u2014 \u4e3b\u89d2\u9762\u4e34\u7684\u6839\u672c\u95ee\u9898\u662f\u4ec0\u4e48\uff1f\n2. **\u4e09\u5e55\u7ed3\u6784** \u2014 \u5f00\u7aef\uff08\u5efa\u7acb\u4e16\u754c\u89c2\u548c\u4eba\u7269\uff09\u3001\u53d1\u5c55\uff08\u51b2\u7a81\u5347\u7ea7\uff09\u3001\u9ad8\u6f6e\u4e0e\u7ed3\u5c40\n3. **\u6bcf\u7ae0\u7684\u94a9\u5b50** \u2014 \u786e\u4fdd\u6bcf\u7ae0\u7ed3\u5c3e\u90fd\u6709\u8ba9\u8bfb\u8005\u7ffb\u9875\u7684\u7406\u7531\n\n\u9700\u8981\u6211\u5e2e\u4f60\u5177\u4f53\u89c4\u5212\u67d0\u4e00\u5377\u7684\u7ec6\u7eb2\u5417\uff1f',
    '\u4eba\u7269': '\u5851\u9020\u4eba\u7269\u7684\u5173\u952e\u4e0d\u662f"\u4ed6\u6709\u591a\u5389\u5bb3"\uff0c\u800c\u662f"\u4ed6\u6709\u591a\u771f\u5b9e"\u3002\n\n\u8bd5\u8bd5\u8fd9\u4e2a\u6846\u67b6\uff1a\n- **\u6b32\u671b**\uff1a\u4ed6\u60f3\u8981\u4ec0\u4e48\uff1f\n- **\u6050\u60e7**\uff1a\u4ed6\u6700\u6015\u5931\u53bb\u4ec0\u4e48\uff1f\n- **\u7f3a\u9677**\uff1a\u4ed6\u6709\u4ec0\u4e48\u81f4\u547d\u7684\u6027\u683c\u5f31\u70b9\uff1f\n- **\u5f27\u5149**\uff1a\u6545\u4e8b\u7ed3\u675f\u65f6\u4ed6\u53d1\u751f\u4e86\u4ec0\u4e48\u53d8\u5316\uff1f\n\n\u4f60\u7684\u4e3b\u89d2\u73b0\u5728\u5904\u4e8e\u54ea\u4e2a\u9636\u6bb5\uff1f',
    '\u8bbe\u5b9a': '\u4e16\u754c\u89c2\u8bbe\u5b9a\u7684\u6838\u5fc3\u539f\u5219\u662f"\u51b0\u5c71\u539f\u5219"\u2014\u2014\u5c55\u73b0\u7ed9\u8bfb\u8005\u7684\u53ea\u662f\u51b0\u5c71\u4e00\u89d2\uff0c\u4f46\u4f5c\u8005\u81ea\u5df1\u8981\u77e5\u9053\u6c34\u9762\u4e0b\u7684\u4e5d\u6210\u3002\n\n\u5efa\u8bae\u6309\u8fd9\u4e2a\u987a\u5e8f\u68b3\u7406\uff1a\n1. \u65f6\u4ee3\u80cc\u666f\uff08\u79d1\u6280\u6c34\u5e73/\u793e\u4f1a\u5f62\u6001\uff09\n2. \u529b\u91cf\u4f53\u7cfb\uff08\u89c4\u5219\u3001\u4ee3\u4ef7\u3001\u4e0a\u9650\uff09\n3. \u52bf\u529b\u5206\u5e03\uff08\u5404\u65b9\u7acb\u573a\u548c\u51b2\u7a81\u70b9\uff09\n4. \u5173\u952e\u5730\u70b9\uff08\u6709\u8fa8\u8bc6\u5ea6\u7684\u573a\u666f\uff09\n\n\u4f60\u73b0\u5728\u5728\u6784\u601d\u54ea\u79cd\u7c7b\u578b\u7684\u6545\u4e8b\uff1f',
    '\u8282\u594f': '\u8282\u594f\u628a\u63a7\u662f\u7f51\u6587\u7684\u6838\u5fc3\u7ade\u4e89\u529b\u3002\n\n\u51e0\u4e2a\u5b9e\u7528\u6280\u5de7\uff1a\n- **\u4e09\u7ae0\u4e00\u5c0f\u9ad8\u6f6e**\uff1a\u6bcf\u4e09\u7ae0\u8981\u7ed9\u8bfb\u8005\u4e00\u4e2a\u723d\u70b9\u6216\u60ac\u5ff5\n- **\u7ae0\u8282\u672b\u5c3e\u94a9\u5b50**\uff1a\u7528\u60ac\u5ff5\u3001\u5bf9\u8bdd\u65ad\u7ae0\u3001\u7a81\u53d1\u4e8b\u4ef6\u6536\u5c3e\n- **\u677e\u7d27\u4ea4\u66ff**\uff1a\u7d27\u5f20\u60c5\u8282\u4e4b\u540e\u5b89\u6392\u7f13\u51b2\u7ae0\u8282\uff0c\u8ba9\u8bfb\u8005\u5598\u53e3\u6c14\n- **\u4fe1\u606f\u63a7\u5236**\uff1a\u4e0d\u8981\u4e00\u6b21\u6027\u629b\u51fa\u6240\u6709\u8bbe\u5b9a\uff0c\u50cf\u5265\u6d0b\u8471\u4e00\u6837\u5c42\u5c42\u9012\u8fdb\n\n\u4f60\u5f53\u524d\u5361\u5728\u54ea\u4e2a\u7ae0\u8282\u7684\u8282\u594f\u4e0a\u4e86\uff1f',
  }

  for (const [keyword, response] of Object.entries(responses)) {
    if (newMessage.includes(keyword)) {
      return response
    }
  }

  return `这是个有趣的角度！让我想想……

作为写作助手，我觉得这个问题可以从几个方面来考虑。首先，要明确你想要达到的叙事效果是什么——是推动剧情、深化人物、还是铺垫伏笔？

如果能给我更多上下文（比如当前章节的情节进展、相关人物的状态），我可以给出更具体的建议。

你方便展开说说吗？`
}
