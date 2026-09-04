import { ArrowRight, FileSpreadsheet, ShieldCheck, WifiOff } from 'lucide-react'

interface WelcomeProps {
  onImport: () => void
  onStart: () => void
}

export function Welcome({ onImport, onStart }: WelcomeProps) {
  return (
    <main className="welcome-screen">
      <div className="welcome-mark">PL</div>
      <span className="eyebrow">BIENVENIDO</span>
      <h1>Tu control de pagos,<br />claro y privado.</h1>
      <p>Administra las cuatro cuentas desde tu teléfono. Tus datos se quedan guardados localmente.</p>
      <div className="welcome-features"><span><ShieldCheck size={18} />Datos privados</span><span><WifiOff size={18} />Funciona sin internet</span></div>
      <div className="welcome-actions">
        <button className="primary-button large" onClick={onImport}><FileSpreadsheet size={20} />Importar mi Excel</button>
        <button className="secondary-button large" onClick={onStart}>Empezar desde cero<ArrowRight size={19} /></button>
      </div>
    </main>
  )
}
