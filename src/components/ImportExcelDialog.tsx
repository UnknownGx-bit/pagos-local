import { AlertTriangle, FileSpreadsheet, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Account, ImportPersonDraft, ImportPreview, ISODate } from '../types'
import { analyzeExcel, commitExcelImport } from '../lib/excel'
import { db } from '../db'
import { Modal } from './Modal'
import { reconcileImportedReviewNotes } from '../lib/personReview'

interface ImportExcelDialogProps {
  open: boolean
  accounts: Account[]
  onClose: () => void
  onImported: (message: string) => void
}

export function ImportExcelDialog({ open, accounts, onClose, onImported }: ImportExcelDialogProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateDraft(index: number, patch: Partial<ImportPersonDraft>) {
    setPreview((current) => current ? {
      ...current,
      people: current.people.map((person, itemIndex) => {
        if (itemIndex !== index) return person
        const next = { ...person, ...patch }
        const changedFields = [
          ...(patch.phone !== undefined ? ['phone' as const] : []),
          ...(patch.joinDate !== undefined ? ['joinDate' as const] : []),
          ...(patch.paidMonths !== undefined ? ['paidMonths' as const] : []),
        ]
        const resolved = reconcileImportedReviewNotes(person.reviewNotes, next, changedFields)
        const canAutoInclude = resolved.length === 0 && (!next.duplicatePersonId || next.duplicateAction !== 'skip')
        return { ...next, reviewNotes: resolved, include: patch.include ?? (canAutoInclude ? true : next.include) }
      }),
    } : current)
  }

  async function chooseFile(file?: File) {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      setPreview(await analyzeExcel(file, accounts))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo analizar el Excel.')
    } finally {
      setLoading(false)
    }
  }

  async function importData() {
    if (!preview) return
    setLoading(true)
    try {
      const result = await commitExcelImport(preview)
      await db.settings.update('app-settings', { onboarded: true })
      onImported(`${result.added} personas importadas, ${result.updated} actualizadas y ${result.skipped} omitidas.`)
      setPreview(null)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo completar la importación.')
    } finally {
      setLoading(false)
    }
  }

  const reviewPeople = preview?.people.map((person, index) => ({ person, index })).filter(({ person }) => person.reviewNotes.length > 0 || person.duplicatePersonId) ?? []
  const included = preview?.people.filter((person) => person.include && person.joinDate && (!person.duplicatePersonId || person.duplicateAction !== 'skip')).length ?? 0

  return (
    <Modal open={open} title="Importar Excel" description="La vista previa no modifica tus datos hasta que confirmes." onClose={onClose} size="large">
      <input ref={fileInput} className="visually-hidden" type="file" accept=".xlsx,.xls" onChange={(event) => void chooseFile(event.target.files?.[0])} />
      {!preview ? (
        <div className="file-drop">
          <FileSpreadsheet size={42} />
          <h3>Selecciona tu archivo</h3>
          <p>Se analizarán únicamente las tablas de personas de las primeras cuatro hojas.</p>
          <button className="primary-button" type="button" onClick={() => fileInput.current?.click()} disabled={loading}><Upload size={18} />{loading ? 'Analizando…' : 'Elegir Excel'}</button>
        </div>
      ) : (
        <div className="import-preview">
          <div className="preview-summary">
            {preview.sheets.map((sheet) => <article key={sheet.sheetName}><span>{sheet.accountName}</span><strong>{sheet.found}</strong><small>{sheet.needsReview ? `${sheet.needsReview} por revisar` : 'Listos'}</small></article>)}
          </div>
          {reviewPeople.length > 0 && (
            <section className="review-section">
              <div className="inline-heading"><AlertTriangle size={19} /><div><h3>Registros que requieren revisión</h3><p>No están seleccionados hasta que corrijas o confirmes sus datos.</p></div></div>
              <div className="review-list">
                {reviewPeople.map(({ person, index }) => (
                  <article className="review-card" key={`${person.accountId}-${person.sourceRow}`}>
                    <div className="review-card-head"><div><strong>{person.displayName}</strong><span>{person.accountName} · fila {person.sourceRow}</span></div><label className="compact-check"><input type="checkbox" checked={person.include} disabled={!person.joinDate} onChange={(event) => updateDraft(index, { include: event.target.checked })} />Importar</label></div>
                    {person.reviewNotes.map((note) => <p className="review-note" key={note}>{note}</p>)}
                    <div className="review-fields">
                      <label>Teléfono<input value={person.phone} onChange={(event) => updateDraft(index, { phone: event.target.value })} /></label>
                      <label>Fecha<input type="date" value={person.joinDate} onChange={(event) => updateDraft(index, { joinDate: event.target.value as ISODate | '', include: Boolean(event.target.value) })} /></label>
                      <label>Meses pagados<input type="number" min="0" value={person.paidMonths} onChange={(event) => updateDraft(index, { paidMonths: Math.max(0, Number(event.target.value)) })} /></label>
                    </div>
                    {person.duplicatePersonId && <label>Persona ya existente<select value={person.duplicateAction} onChange={(event) => updateDraft(index, { duplicateAction: event.target.value as ImportPersonDraft['duplicateAction'], include: true })}><option value="skip">Omitir</option><option value="update">Actualizar</option><option value="duplicate">Duplicar de todos modos</option></select></label>}
                  </article>
                ))}
              </div>
            </section>
          )}
          <p className="privacy-note">Se importarán {included} personas. El archivo se procesa únicamente en este dispositivo.</p>
          <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setPreview(null)}>Elegir otro</button><button className="primary-button" type="button" disabled={loading || included === 0} onClick={() => void importData()}>{loading ? 'Importando…' : 'Importar datos'}</button></div>
        </div>
      )}
      {error && <p className="error-message">{error}</p>}
    </Modal>
  )
}
