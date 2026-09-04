import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.pagolocal.app',
  appName: 'Pagos Local',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0f2740',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_payments',
      iconColor: '#0f2740',
    },
  },
}

export default config
