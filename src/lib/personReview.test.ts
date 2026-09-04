import { describe, expect, it } from 'vitest'
import { personReviewNotes, reconcileImportedReviewNotes } from './personReview'

describe('personReviewNotes', () => {
  it('clears imported warnings after valid manual corrections', () => {
    expect(personReviewNotes('9513353760', '2026-08-04', 1)).toEqual([])
    expect(personReviewNotes('+52 221 438 0516', '2026-07-08', 2)).toEqual([])
  })

  it('keeps a useful warning for text in a phone number', () => {
    expect(personReviewNotes('Erick', '2026-07-08', 2)).toEqual([
      'El teléfono contiene texto: “Erick”.',
    ])
  })

  it('removes only the imported warning whose field was corrected', () => {
    const previous = [
      'El teléfono contiene texto: “Erick”.',
      'Pago no interpretado: LANK.',
    ]
    expect(reconcileImportedReviewNotes(previous, {
      phone: '9513353760',
      joinDate: '2026-07-08',
      paidMonths: 2,
    }, ['phone'])).toEqual(['Pago no interpretado: LANK.'])
    expect(reconcileImportedReviewNotes(previous, {
      phone: '9513353760',
      joinDate: '2026-07-08',
      paidMonths: 2,
    }, ['phone', 'paidMonths'])).toEqual([])
  })
})
