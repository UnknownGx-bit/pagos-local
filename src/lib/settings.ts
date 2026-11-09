import type { AppSettings } from '../types'

// One-time upgrade of reminder preferences; never rewrites people or payments.
export function upgradeReminderSettings(settings: AppSettings): AppSettings {
  return settings.reminderPolicyVersion === 1 ? settings : {
    ...settings, reminderDaysBefore: 1, reminderTime: '10:00', reminderPolicyVersion: 1,
  }
}
