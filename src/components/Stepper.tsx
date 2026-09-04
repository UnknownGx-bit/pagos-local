import { Minus, Plus } from 'lucide-react'

interface StepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label: string
}

export function Stepper({ value, onChange, min = 0, max = 120, label }: StepperProps) {
  return (
    <div className="stepper" aria-label={label}>
      <button type="button" aria-label="Restar" onClick={() => onChange(Math.max(min, value - 1))}><Minus size={20} /></button>
      <div><strong>{value}</strong><span>{value === 1 ? 'mes' : 'meses'}</span></div>
      <button type="button" aria-label="Sumar" onClick={() => onChange(Math.min(max, value + 1))}><Plus size={20} /></button>
    </div>
  )
}
