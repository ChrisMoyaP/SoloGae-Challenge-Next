export const calcWinrate = (w: number, l: number) => {
  const total = w + l
  if (!total) return 0
  return Math.round((w / total) * 100)
}
