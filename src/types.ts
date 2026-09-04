export type ISODate = `${number}-${number}-${number}`

export interface Account {
  id: string
  name: string
  order: number
}

export interface Person {
  id: string
  accountId: string
  personNumber: number | null
  displayName: string
  phone: string
  devices: string[]
  joinDate: ISODate
  paidMonths: number
  manuallyUnpaid: boolean
  needsReview: boolean
  reviewNotes: string[]
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  personId: string
  paidAt: string
  months: number
  previousDueDate: ISODate
  newDueDate: ISODate
}

export interface AppSettings {
  id: 'app-settings'
  reminderDaysBefore: number
  reminderTime: string
  onboarded: boolean
}

export type PaymentStatus =
  | 'current'
  | 'upcoming'
  | 'due-today'
  | 'overdue'
  | 'manual-unpaid'

export interface ImportPersonDraft {
  sourceRow: number
  accountId: string
  accountName: string
  personNumber: number | null
  displayName: string
  phone: string
  devices: string[]
  joinDate: ISODate | ''
  paidMonths: number
  reviewNotes: string[]
  duplicatePersonId?: string
  duplicateAction: 'skip' | 'update' | 'duplicate'
  include: boolean
}

export interface ImportSheetPreview {
  sheetName: string
  accountId: string
  accountName: string
  found: number
  safe: number
  needsReview: number
}

export interface ImportPreview {
  fileName: string
  sheets: ImportSheetPreview[]
  people: ImportPersonDraft[]
  ignoredSheetNames: string[]
}

export interface BackupPayload {
  format: 'pagos-local-backup'
  version: 1
  exportedAt: string
  accounts: Account[]
  people: Person[]
  payments: Payment[]
  settings: AppSettings
}
