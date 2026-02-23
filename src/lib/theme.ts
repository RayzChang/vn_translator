const DARK_KEY = 'tw-vn-translator-dark'

export function getStoredDark(): boolean {
  return localStorage.getItem(DARK_KEY) === '1'
}

export function setStoredDark(dark: boolean): void {
  localStorage.setItem(DARK_KEY, dark ? '1' : '0')
  applyDark(dark)
}

export function applyDark(dark: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', dark)
}
