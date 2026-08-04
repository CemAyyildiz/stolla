export function truncateMiddle(str: string, start = 6, end = 4): string {
  if (str.length <= start + end) return str;
  return `${str.slice(0, start)}\u2026${str.slice(-end)}`;
}

export function truncateEnd(str: string, max = 12): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}\u2026`;
}
