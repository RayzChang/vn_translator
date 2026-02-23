export interface HistoryItem {
  id: string
  input: string
  output: string
  direction: 'vn2zh' | 'zh2vn'
  createdAt: number
}

const STORAGE_KEY = 'tw-vn-translator-history'
const MAX_ITEMS = 30

export function getHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as HistoryItem[]
    return Array.isArray(list) ? list.slice(0, MAX_ITEMS) : []
  } catch {
    return []
  }
}

export function addHistory(item: Omit<HistoryItem, 'id' | 'createdAt'>): void {
  const list = getHistory()
  const newItem: HistoryItem = {
    ...item,
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now()
  }
  const next = [newItem, ...list.filter((x) => x.input !== item.input || x.output !== item.output)].slice(0, MAX_ITEMS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY)
}
