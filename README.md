# Pagos Local

Aplicación móvil/PWA para administrar pagos mensuales de personas distribuidas en cuatro cuentas. Toda la información se guarda localmente en IndexedDB y no depende de un servidor.

## Funciones

- Alta, edición, cambio de cuenta y eliminación con confirmación.
- Cálculo mensual por calendario con política de último día válido para fechas 29, 30 y 31.
- Registro e historial de pagos.
- Estados automáticos, marca manual “No ha pagado”, filtros, buscador y ordenamiento.
- Importación segura de Excel con vista previa, revisión y detección de duplicados.
- Exportación a Excel y copias completas JSON.
- PWA instalable y funcional sin conexión.
- Android mediante Capacitor con notificaciones locales agrupadas y reprogramación automática.

## Privacidad

El repositorio no incluye el archivo de origen ni datos personales. La importación ocurre dentro del dispositivo del usuario.

## Desarrollo

```bash
pnpm install
pnpm test
pnpm build
pnpm exec cap sync android
```

La PWA no puede garantizar notificaciones programadas cuando el navegador está completamente cerrado. Esa función usa `@capacitor/local-notifications` en Android.
