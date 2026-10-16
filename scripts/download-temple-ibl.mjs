import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'

const name = 'kloofendal_overcast_puresky'
const directory = new URL('../art/source/environment/', import.meta.url)
const target = new URL(name + '_1k.hdr', directory)
function validate(bytes) {
  const { width, height, data } = new HDRLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  if (width !== 1024 || height !== 512 || !data.length) throw new Error('Unexpected HDR dimensions')
}
try {
  let existing
  try { existing = await readFile(target); validate(existing) } catch { existing = null }
  if (existing) { console.log('Temple HDR already downloaded and validated.'); process.exitCode = 0 }
  else {
    const response = await fetch('https://api.polyhaven.com/files/' + name, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error('Poly Haven API HTTP ' + response.status)
    const files = await response.json()
    const asset = files.hdri['1k'].hdr
    if (!asset.url.startsWith('https://dl.polyhaven.org/')) throw new Error('Unexpected download host')
    const download = await fetch(asset.url, { signal: AbortSignal.timeout(45000) })
    if (!download.ok) throw new Error('HDR HTTP ' + download.status)
    const bytes = Buffer.from(await download.arrayBuffer())
    validate(bytes)
    const md5 = createHash('md5').update(bytes).digest('hex')
    if (asset.md5 && md5 !== asset.md5) throw new Error('HDR checksum mismatch')
    await mkdir(directory, {recursive:true})
    await writeFile(new URL(name + '_1k.hdr.download', directory), bytes)
    await rename(new URL(name + '_1k.hdr.download', directory), target)
    await writeFile(new URL(name + '_license.json', directory), JSON.stringify({
      title:'Kloofendal Overcast (Pure Sky)',author:'Greg Zaal',license:'CC0-1.0',
      source:'https://polyhaven.com/a/'+name,url:asset.url,md5,
    },null,2)+'\n')
    console.log('Downloaded and validated temple HDR: ' + bytes.length + ' bytes')
  }
} catch (error) { console.error('Temple HDR download failed:', error.message); process.exitCode = 1 }
