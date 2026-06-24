# 书架功能设计文档

**日期**: 2026-06-24  
**分支**: main  
**范围**: 纯前端，localStorage 存储，无需后端

---

## 目标

将当前"一本书"的应用扩展为支持多本小说管理。顶栏「设置」旁新增「书架」菜单，用户可创建、切换、管理多部作品。

## 数据结构变更

### 现状

store 中直接存一本书的字段：`novelTitle, novelIntro, outlines, chapters, currentChapterId, conversations, activeConversationId`

### 目标

引入 `Novel` 聚合，store 改为管理小说列表：

```typescript
interface Novel {
  id: string
  title: string           // 原 novelTitle
  intro: string           // 原 novelIntro  
  outlines: OutlineNode[]
  chapters: Chapter[]
  currentChapterId: string | null
  conversations: Conversation[]
  activeConversationId: string | null
  createdAt: string
  updatedAt: string
}

// Store 增加
novels: Novel[]
currentNovelId: string | null
```

### localStorage 迁移

加载时检测旧格式（存在 `novelTitle` 字段），自动包裹为单本小说的 `novels` 数组，迁移后清除旧 key。

### 向后兼容

- `getCurrentChapter()` — 通过 `currentNovelId` 定位当前书
- `updateChapter()` — 操作当前书的 chapters
- 其余 actions 同理，全部代理到当前小说的上下文

---

## UI 设计

### 顶栏

在「设置」按钮和「AI 面板」按钮之间插入「书架」按钮（📚 图标）：

```
[☰ 笔灵] ................ [设置] [书架] [AI 面板]
```

### 书架下拉菜单

宽度约 220px，结构：

```
┌─────────────────────────┐
│  📖 当前小说（高亮）      │  ← 不可点击，标识当前
├─────────────────────────┤
│  未命名作品 2            │  ← 点击切换
│  修仙传                   │  ← 点击切换
├─────────────────────────┤
│  ＋ 添加新书              │  ← 底部操作
└─────────────────────────┘
```

- 点击其他小说 → 切换 `currentNovelId`，编辑器/大纲/对话全部刷新
- 点击「+ 添加新书」→ 创建空小说，自动切换
- 每行右侧 hover 显示更多操作（重命名、删除，需二次确认）
- 列表超过 6 本可滚动

### 上下文联动

切换小说时：
- **编辑器** 切换到新书的 `currentChapterId` 对应章节
- **左侧大纲树** 切换到新书的 `outlines`
- **AI 面板** 切换到新书的对话列表
- **参考资料面板** 清空选中状态
- 字数统计、章节列表全部更新

---

## 实现步骤

1. **types.ts** — 新增 `Novel` 接口
2. **defaults.ts** — 新增 `createDefaultNovel()` 工厂函数
3. **persistence.ts** — 更新 save/load 逻辑，加入数据迁移
4. **useStore.ts** — store 改为多书结构，actions 代理到当前小说
5. **NovelSwitcher.tsx** — 新建书架下拉组件（顶栏按钮 + 菜单）
6. **App.tsx** — 插入 NovelSwitcher 到顶栏
7. **其他组件** — 适配新的数据读取方式

## 注意事项

- 旧数据迁移只执行一次，成功后旧格式清除
- 删除当前小说时自动切到最后一部，如果只有一部则置灰删除按钮（至少要保留一本书）
- 切换小说时编辑器内容可能不同，需触发 TipTap 的 `setContent`
