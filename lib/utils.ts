import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateUniqueId(seed?: string): string {
  if (seed) {
    return `${seed}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
