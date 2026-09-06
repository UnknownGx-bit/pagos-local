import { Capacitor } from '@capacitor/core'

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export async function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo preparar el archivo.'))
    reader.onload = () => {
      const result = String(reader.result)
      const separator = result.indexOf(',')
      if (separator < 0) reject(new Error('No se pudo preparar el archivo.'))
      else resolve(result.slice(separator + 1))
    }
    reader.readAsDataURL(blob)
  })
}

export async function saveOrShareBlob(blob: Blob, fileName: string, title: string) {
  if (!Capacitor.isNativePlatform()) {
    downloadBlob(blob, fileName)
    return
  }

  const [{ Directory, Filesystem }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const saved = await Filesystem.writeFile({
    path: fileName,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  })

  await Share.share({
    title,
    text: 'Guarda este archivo en un lugar seguro para poder recuperar tus datos.',
    files: [saved.uri],
    dialogTitle: 'Guardar o compartir archivo',
  })
}

export async function readTextFile(file: File) {
  return file.text()
}
