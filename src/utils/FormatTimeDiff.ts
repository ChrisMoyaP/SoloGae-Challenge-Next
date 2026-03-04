export const formatTimeDiff = (ms: number) => {
  if (ms < 0) ms = 0
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / (3600 * 24))
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}
