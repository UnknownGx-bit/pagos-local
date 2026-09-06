const dismissers: Array<() => void> = []

export function registerDialogDismiss(dismiss: () => void) {
  dismissers.push(dismiss)
  return () => {
    const index = dismissers.indexOf(dismiss)
    if (index >= 0) dismissers.splice(index, 1)
  }
}

export function dismissTopDialog() {
  const dismiss = dismissers.at(-1)
  if (!dismiss) return false
  dismiss()
  return true
}
