/**
 * 章节编号工具：解析"第X章"中的中文数字，并生成下一个章节名。
 */

const CHINESE_DIGITS: Record<string, number> = {
  '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
}

const CHINESE_UNITS: { unit: string; value: number }[] = [
  { unit: '千', value: 1000 },
  { unit: '百', value: 100 },
  { unit: '十', value: 10 },
]

const NUMBER_TO_CHINESE: string[] = [
  '零', '一', '二', '三', '四', '五', '六', '七', '八', '九',
]

/** 解析中文数字字符串为整数，例如 "二十三" → 23, "一百零五" → 105, "十" → 10 */
export function parseChineseNumber(text: string): number | null {
  if (!text || text.length === 0) return null

  let s = text.trim()

  // 尝试直接数字
  const plain = parseInt(s, 10)
  if (!isNaN(plain) && plain.toString() === s) return plain

  let result = 0
  let lastUnit = 0

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]

    if (ch === '零') {
      continue
    }

    if (ch === '十') {
      if (i === 0 || lastUnit > 0) {
        // 只有"十"开头（如"十一"=11 的第一位，或单独的"十"=10）
        result += lastUnit > 0 ? 0 : 10
        lastUnit = 10
      } else {
        lastUnit = 10
      }
      continue
    }

    const unitIdx = CHINESE_UNITS.findIndex((u) => u.unit === ch)
    if (unitIdx >= 0) {
      const val = CHINESE_UNITS[unitIdx].value
      if (lastUnit === 0) lastUnit = 1
      result += lastUnit * val
      lastUnit = 0
      continue
    }

    const digit = CHINESE_DIGITS[ch]
    if (digit !== undefined) {
      if (i === s.length - 1) {
        // 末位是个位数字
        result += digit
      } else {
        // 暂存，等待下一个单位
        lastUnit = digit
      }
    }
  }

  if (lastUnit > 0) {
    result += lastUnit
  }

  return result > 0 ? result : null
}

/** 整型数字转中文数字，例如 23 → "二十三", 105 → "一百零五" */
export function toChineseNumber(n: number): string {
  if (n < 0) return ''
  if (n === 0) return '零'
  if (n <= 10) return n === 10 ? '十' : NUMBER_TO_CHINESE[n]
  if (n < 20) return '十' + NUMBER_TO_CHINESE[n - 10]
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    return NUMBER_TO_CHINESE[tens] + '十' + (ones === 0 ? '' : NUMBER_TO_CHINESE[ones])
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100)
    const rest = n % 100
    const restStr = rest === 0 ? '' : (rest < 10 ? '零' : '') + toChineseNumber(rest)
    return NUMBER_TO_CHINESE[hundreds] + '百' + restStr
  }
  if (n < 10000) {
    const thousands = Math.floor(n / 1000)
    const rest = n % 1000
    const restStr = rest === 0 ? '' : (rest < 100 ? '零' : '') + toChineseNumber(rest)
    return NUMBER_TO_CHINESE[thousands] + '千' + restStr
  }
  // 万以上简单处理
  const wan = Math.floor(n / 10000)
  const rest = n % 10000
  const restStr = rest === 0 ? '' : (rest < 1000 ? '零' : '') + toChineseNumber(rest)
  return toChineseNumber(wan) + '万' + restStr
}

/** 从"第X章"格式中提取数字，返回整数；非标准格式返回 null */
function extractChapterNumber(title: string): number | null {
  const match = title.match(/第(.+?)章/)
  if (!match) return null
  return parseChineseNumber(match[1])
}

/** 给定章节列表，返回下一个章节标题 */
export function getNextChapterTitle(chapters: { title: string }[]): string {
  let maxNum = 0

  for (const ch of chapters) {
    const num = extractChapterNumber(ch.title)
    if (num !== null && num > maxNum) {
      maxNum = num
    }
  }

  const nextNum = maxNum + 1
  // 如果没有任何有效章节号，按列表长度来
  if (maxNum === 0 && chapters.length === 0) {
    return '第一章'
  }

  const finalNum = maxNum > 0 ? nextNum : chapters.length + 1
  return '第' + toChineseNumber(finalNum) + '章'
}
