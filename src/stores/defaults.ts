import { v4 as uuidv4 } from 'uuid'
import type { OutlineNode, Chapter, Conversation, Novel } from './types'

// ===== Defaults =====

const defaultContent = `<p></p>`

export function createDefaultChapter(): Chapter {
  const now = new Date().toISOString()
  return {
    id: uuidv4(),
    title: '第一章',
    content: defaultContent,
    wordCount: 0,
    createdAt: now,
    updatedAt: now,
  }
}

export function createDefaultConversation(): Conversation {
  return {
    id: uuidv4(),
    title: 'AI灵感页',
    messages: [],
    createdAt: new Date().toISOString(),
  }
}

export function createDefaultOutlines(): OutlineNode[] {
  return [
    {
      id: uuidv4(), title: '书名与简介', content: '', expanded: true,
      children: [
        { id: uuidv4(), title: '书名', content: '', expanded: true, children: [] },
        { id: uuidv4(), title: '一句话简介', content: '', expanded: true, children: [] },
        { id: uuidv4(), title: '标签/类型', content: '', expanded: true, children: [] },
      ],
    },
    {
      id: uuidv4(), title: '世界观设定', content: '', expanded: true,
      children: [
        { id: uuidv4(), title: '时代背景', content: '', expanded: false, children: [] },
        { id: uuidv4(), title: '势力格局', content: '', expanded: false, children: [] },
        { id: uuidv4(), title: '修炼体系', content: '', expanded: false, children: [] },
        { id: uuidv4(), title: '重要地点', content: '', expanded: false, children: [] },
      ],
    },
    {
      id: uuidv4(), title: '人物设定', content: '', expanded: true,
      children: [
        { id: uuidv4(), title: '主角', content: '', expanded: false, children: [] },
        { id: uuidv4(), title: '重要配角', content: '', expanded: false, children: [] },
        { id: uuidv4(), title: '反派', content: '', expanded: false, children: [] },
      ],
    },
    {
      id: uuidv4(), title: '大纲', content: '', expanded: true,
      children: [
        {
          id: uuidv4(), title: '第一卷', content: '', expanded: true,
          children: [
            { id: uuidv4(), title: '细纲1：开局困境', content: '', expanded: false, children: [] },
            { id: uuidv4(), title: '细纲2：获得机缘', content: '', expanded: false, children: [] },
            { id: uuidv4(), title: '细纲3：初露锋芒', content: '', expanded: false, children: [] },
          ],
        },
      ],
    },
  ]
}

export function createDefaultNovel(title = '未命名作品'): Novel {
  const now = new Date().toISOString()
  const ch1 = createDefaultChapter()
  const conv = createDefaultConversation()
  const outlines = createDefaultOutlines()
  // 书名节点是 书名与简介 → 第一个子节点
  const bookTitleNodeId = outlines[0]?.children?.[0]?.id ?? ''
  return {
    id: uuidv4(),
    title,
    intro: '',
    bookTitleNodeId,
    outlines,
    chapters: [ch1],
    currentChapterId: ch1.id,
    conversations: [conv],
    activeConversationId: conv.id,
    createdAt: now,
    updatedAt: now,
  }
}

export function createDefaultProject() {
  const novel = createDefaultNovel()
  return {
    novels: [novel],
    currentNovelId: novel.id,
  }
}
