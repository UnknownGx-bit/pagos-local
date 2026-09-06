import { Capacitor } from '@capacitor/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { blobToBase64, saveOrShareBlob } from './files'

const nativeMocks = vi.hoisted(() => ({
  writeFile: vi.fn().mockResolvedValue({ uri: 'file:///cache/copia.json' }),
  share: vi.fn().mockResolvedValue({ activityType: '' }),
}))

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { writeFile: nativeMocks.writeFile },
}))

vi.mock('@capacitor/share', () => ({
  Share: { share: nativeMocks.share },
}))

describe('guardado de archivos', () => {
  beforeEach(() => {
    nativeMocks.writeFile.mockResolvedValue({ uri: 'file:///cache/copia.json' })
    nativeMocks.share.mockResolvedValue({ activityType: '' })
  })
  afterEach(() => vi.restoreAllMocks())

  it('convierte bytes binarios a base64 sin alterar el contenido', async () => {
    const source = new Uint8Array([0, 1, 127, 128, 255])
    expect(await blobToBase64(new Blob([source]))).toBe('AAF/gP8=')
  })

  it('usa el selector nativo de Android para exportar la copia', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    const blob = new Blob(['á'], { type: 'application/json' })

    await saveOrShareBlob(blob, 'copia.json', 'Copia de seguridad')

    expect(nativeMocks.writeFile).toHaveBeenCalledWith({
      path: 'copia.json',
      data: 'w6E=',
      directory: 'CACHE',
    })
    expect(nativeMocks.share).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Copia de seguridad',
      files: ['file:///cache/copia.json'],
    }))
  })
})
