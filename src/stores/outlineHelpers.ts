import type { OutlineNode } from './types'

// ===== Outline tree helpers =====

export function findInTree(nodes: OutlineNode[], id: string): OutlineNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findInTree(n.children, id)
    if (found) return found
  }
  return null
}

export function addToParent(nodes: OutlineNode[], parentId: string | null, newNode: OutlineNode): OutlineNode[] {
  if (parentId === null) return [...nodes, newNode]
  return nodes.map(n => {
    if (n.id === parentId) return { ...n, children: [...n.children, newNode] }
    return { ...n, children: addToParent(n.children, parentId, newNode) }
  })
}

export function findAndUpdate(nodes: OutlineNode[], id: string, updates: Partial<OutlineNode>): OutlineNode[] {
  return nodes.map(n => {
    if (n.id === id) return { ...n, ...updates }
    return { ...n, children: findAndUpdate(n.children, id, updates) }
  })
}

export function findAndRemove(nodes: OutlineNode[], id: string): OutlineNode[] {
  return nodes
    .filter(n => n.id !== id)
    .map(n => ({ ...n, children: findAndRemove(n.children, id) }))
}

export function findAndToggle(nodes: OutlineNode[], id: string): OutlineNode[] {
  return nodes.map(n => {
    if (n.id === id) return { ...n, expanded: !n.expanded }
    return { ...n, children: findAndToggle(n.children, id) }
  })
}
