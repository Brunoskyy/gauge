/** RFC 4180: quote when the value has a comma, quote or newline; double the quotes. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function csvLine(values: readonly unknown[]): string {
  return values.map(csvCell).join(',') + '\r\n'
}
