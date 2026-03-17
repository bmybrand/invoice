export function formatInvoiceCode(id: number): string {
  const mixed = (id * 7919 + 12345) % 100000
  const normalized = Math.abs(mixed)
  return String(normalized).padStart(5, '0')
}
