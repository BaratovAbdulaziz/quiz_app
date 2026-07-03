export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ")
}

export function generateUniqueId(_seed?: string): string {
  return crypto.randomUUID()
}
