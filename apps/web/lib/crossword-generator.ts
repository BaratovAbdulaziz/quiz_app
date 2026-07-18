export interface ParsedClue {
  clue: string
  answer: string
}

export interface CrosswordCluePlacement {
  word: string
  clue: string
  direction: "across" | "down"
  row: number
  col: number
  number: number
  order: number
}

export interface CrosswordGridResult {
  width: number
  height: number
  placements: CrosswordCluePlacement[]
}

export function parseCrosswordInput(text: string): ParsedClue[] {
  const result: ParsedClue[] = []
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const colonIdx = trimmed.indexOf(":")
    if (colonIdx === -1) throw new Error(`Missing colon separator in: "${trimmed}"`)
    const clue = trimmed.slice(0, colonIdx).trim()
    const answer = trimmed.slice(colonIdx + 1).trim().toUpperCase().replace(/[^A-Z]/g, "")
    if (!clue) throw new Error(`Empty clue in: "${trimmed}"`)
    if (!answer) throw new Error(`Invalid or empty answer in: "${trimmed}"`)
    result.push({ clue, answer })
  }
  if (result.length === 0) throw new Error("No valid clue/answer pairs found")
  return result
}

export function generateCrosswordGrid(pairs: ParsedClue[]): CrosswordGridResult {
  const size = Math.max(...pairs.map(p => p.answer.length)) + 2
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(" "))
  const placements: CrosswordCluePlacement[] = []
  let nextNumber = 1
  let order = 0

  const sorted = [...pairs].map((p, i) => ({ ...p, origIdx: i })).sort((a, b) => b.answer.length - a.answer.length)

  for (let wi = 0; wi < sorted.length; wi++) {
    const { clue, answer } = sorted[wi]
    const word = answer.toUpperCase()

    if (wi === 0) {
      const row = Math.floor(size / 2)
      const col = Math.floor((size - word.length) / 2)
      for (let j = 0; j < word.length; j++) grid[row][col + j] = word[j]
      placements.push({ word, clue, direction: "across", row, col, number: nextNumber++, order: order++ })
      continue
    }

    let bestRow = -1, bestCol = -1, bestDir: "across" | "down" = "across"

    for (const dir of ["across", "down"] as const) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (dir === "across" && c + word.length > size) continue
          if (dir === "down" && r + word.length > size) continue
          if (canPlace(grid, word, r, c, dir, size)) {
            bestRow = r; bestCol = c; bestDir = dir
            break
          }
        }
        if (bestRow !== -1) break
      }
      if (bestRow !== -1) break
    }

    if (bestRow === -1) continue

    for (let j = 0; j < word.length; j++) {
      if (bestDir === "across") grid[bestRow][bestCol + j] = word[j]
      else grid[bestRow + j][bestCol] = word[j]
    }
    placements.push({ word, clue, direction: bestDir, row: bestRow, col: bestCol, number: nextNumber++, order: order++ })
  }

  let minR = size, maxR = -1, minC = size, maxC = -1
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (grid[r][c] !== " ") {
        if (r < minR) minR = r
        if (r > maxR) maxR = r
        if (c < minC) minC = c
        if (c > maxC) maxC = c
      }

  for (const p of placements) {
    p.row -= minR
    p.col -= minC
  }

  return {
    width: maxC - minC + 1,
    height: maxR - minR + 1,
    placements: placements.sort((a, b) => a.order - b.order),
  }
}

function canPlace(
  grid: string[][],
  word: string,
  startR: number,
  startC: number,
  dir: "across" | "down",
  size: number,
): boolean {
  if (dir === "across" && startC + word.length > size) return false
  if (dir === "down" && startR + word.length > size) return false

  let crossings = 0
  for (let j = 0; j < word.length; j++) {
    const r = dir === "across" ? startR : startR + j
    const c = dir === "across" ? startC + j : startC
    const cell = grid[r][c]
    if (cell === " ") continue
    if (cell !== word[j]) return false
    crossings++
  }
  if (crossings === 0) return false

  if (dir === "across") {
    if (startC > 0 && grid[startR][startC - 1] !== " ") return false
    if (startC + word.length < size && grid[startR][startC + word.length] !== " ") return false
  } else {
    if (startR > 0 && grid[startR - 1][startC] !== " ") return false
    if (startR + word.length < size && grid[startR + word.length][startC] !== " ") return false
  }

  for (let j = 0; j < word.length; j++) {
    const r = dir === "across" ? startR : startR + j
    const c = dir === "across" ? startC + j : startC
    if (dir === "across") {
      if (r > 0 && grid[r - 1][c] !== " " && !isPartOfWord(r - 1, c, grid, size)) return false
      if (r + 1 < size && grid[r + 1][c] !== " " && !isPartOfWord(r + 1, c, grid, size)) return false
    } else {
      if (c > 0 && grid[r][c - 1] !== " " && !isPartOfWord(r, c - 1, grid, size)) return false
      if (c + 1 < size && grid[r][c + 1] !== " " && !isPartOfWord(r, c + 1, grid, size)) return false
    }
  }

  return true
}

function isPartOfWord(r: number, c: number, grid: string[][], size: number): boolean {
  if (grid[r][c] === " ") return false
  if (c > 0 && grid[r][c - 1] !== " ") return true
  if (c + 1 < size && grid[r][c + 1] !== " ") return true
  if (r > 0 && grid[r - 1][c] !== " ") return true
  if (r + 1 < size && grid[r + 1][c] !== " ") return true
  return false
}
