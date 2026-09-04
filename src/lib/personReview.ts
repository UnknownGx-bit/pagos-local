import type { ISODate } from '../types'
import { isISODate } from './dates'

export function personReviewNotes(phone: string, joinDate: ISODate | string, paidMonths: number) {
  const notes: string[] = []
  const trimmedPhone = phone.trim()

  if (!isISODate(joinDate)) notes.push('Falta una fecha de ingreso válida.')
  if (trimmedPhone && !/^(?=.*\d)\+?[\d\s().-]{7,}$/.test(trimmedPhone)) {
    notes.push(`El teléfono contiene texto: “${trimmedPhone}”.`)
  }
  if (!Number.isFinite(paidMonths) || paidMonths < 0) notes.push('La cantidad de meses pagados no es válida.')

  return notes
}

type ReviewField = 'phone' | 'joinDate' | 'paidMonths'

function noteField(note: string): ReviewField | null {
  if (note.startsWith('El teléfono')) return 'phone'
  if (note.startsWith('Falta una fecha')) return 'joinDate'
  if (note.startsWith('Pago no interpretado') || note.startsWith('La cantidad de meses')) return 'paidMonths'
  return null
}

export function reconcileImportedReviewNotes(
  previousNotes: string[],
  input: { phone: string; joinDate: ISODate | string; paidMonths: number },
  changedFields: ReviewField[],
) {
  const changed = new Set(changedFields)
  const preserved = previousNotes.filter((note) => {
    const field = noteField(note)
    return !field || !changed.has(field)
  })
  const live = personReviewNotes(input.phone, input.joinDate, input.paidMonths)
    .filter((note) => {
      const field = noteField(note)
      return Boolean(field && changed.has(field))
    })
  return [...new Set([...preserved, ...live])]
}
