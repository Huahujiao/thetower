// All decoration follows occupied cells, including after rotation.
export function bagShapeLayout(shape) {
  const cells = []
  const runs = []
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue
      cells.push({ x, y, edges: [!shape[y - 1]?.[x], !shape[y]?.[x + 1], !shape[y + 1]?.[x], !shape[y]?.[x - 1]] })
      if (!shape[y][x - 1]) {
        let width = 1
        while (shape[y][x + width]) width++
        runs.push({ x, y, width })
      }
    }
  }
  return { cells, name: runs[0], detail: runs.at(-1) }
}
