// Server-side image checks: verifies the real file type from its bytes (not the claimed one), limits dimensions,
// and strips metadata (EXIF GPS, comments) without needing an image library.
const MAX_SIDE = 8000
const MAX_PIXELS = 40_000_000
const fail = (m) => Object.assign(new Error(m), { status: 400 })

function checkDims(w, h) {
  if (!w || !h) throw fail('That image looks damaged')
  if (w > MAX_SIDE || h > MAX_SIDE || w * h > MAX_PIXELS) throw fail('That image is too large (max 8000 px per side)')
}

function cleanJpeg(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) throw fail('Not a valid JPEG')
  const out = [b.subarray(0, 2)]
  let i = 2, dims = null
  while (i < b.length) {
    if (b[i] !== 0xff) throw fail('That JPEG looks damaged')
    const m = b[i + 1]
    if (m === 0xff) { i++; continue }
    if (m === 0xd9) { out.push(b.subarray(i, i + 2)); i += 2; break }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { out.push(b.subarray(i, i + 2)); i += 2; continue }
    const len = b.readUInt16BE(i + 2)
    if (len < 2 || i + 2 + len > b.length) throw fail('That JPEG looks damaged')
    if (((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) && !dims)
      dims = [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]
    // drop EXIF/XMP (E1), Photoshop (ED), other APPn except JFIF/ICC/Adobe, and comments (FE)
    const drop = m === 0xe1 || m === 0xed || m === 0xfe || (m >= 0xe3 && m <= 0xec) || m === 0xef
    if (m === 0xda) { out.push(b.subarray(i)); i = b.length; break } // start of scan: copy the rest as is
    if (!drop) out.push(b.subarray(i, i + 2 + len))
    i += 2 + len
  }
  if (!dims) throw fail('That JPEG looks damaged')
  checkDims(...dims)
  return Buffer.concat(out)
}

function cleanPng(b) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!b.subarray(0, 8).equals(sig)) throw fail('Not a valid PNG')
  const keep = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'pHYs', 'acTL', 'fcTL', 'fdAT'])
  const out = [sig]
  let i = 8, dims = null, sawEnd = false
  while (i + 12 <= b.length) {
    const len = b.readUInt32BE(i)
    const type = b.toString('latin1', i + 4, i + 8)
    if (i + 12 + len > b.length) throw fail('That PNG looks damaged')
    if (type === 'IHDR') dims = [b.readUInt32BE(i + 8), b.readUInt32BE(i + 12)]
    if (keep.has(type)) out.push(b.subarray(i, i + 12 + len))
    i += 12 + len
    if (type === 'IEND') { sawEnd = true; break }
  }
  if (!dims || !sawEnd) throw fail('That PNG looks damaged')
  checkDims(...dims)
  return Buffer.concat(out)
}

function cleanWebp(b) {
  if (b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') throw fail('Not a valid WebP')
  const chunks = []
  let i = 12, dims = null
  while (i + 8 <= b.length) {
    const type = b.toString('latin1', i, i + 4)
    const size = b.readUInt32LE(i + 4)
    const end = i + 8 + size + (size & 1)
    if (i + 8 + size > b.length) throw fail('That WebP looks damaged')
    let data = b.subarray(i, Math.min(end, b.length))
    if (type === 'VP8X') {
      dims = [1 + (b.readUIntLE(i + 12, 3)), 1 + (b.readUIntLE(i + 15, 3))]
      data = Buffer.from(data)
      data[8] &= ~0x0c // clear the EXIF + XMP flags
    } else if (type === 'VP8L' && !dims) dims = [1 + (b.readUInt16LE(i + 9) & 0x3fff), 1 + ((b.readUInt32LE(i + 9) >> 14) & 0x3fff)]
    else if (type === 'VP8 ' && !dims) dims = [b.readUInt16LE(i + 14) & 0x3fff, b.readUInt16LE(i + 16) & 0x3fff]
    if (type !== 'EXIF' && type !== 'XMP ') chunks.push(data)
    i = end
  }
  if (!dims) throw fail('That WebP looks damaged')
  checkDims(...dims)
  const body = Buffer.concat([Buffer.from('WEBP'), ...chunks])
  const head = Buffer.alloc(8)
  head.write('RIFF', 0, 'latin1')
  head.writeUInt32LE(body.length, 4)
  return Buffer.concat([head, body])
}

/** Takes the decoded bytes, returns { buf, ext } or throws a 400 error. Ignores the client's claimed type. */
export function sanitizeImage(buf) {
  if (buf.length < 16) throw fail('That file is not an image')
  if (buf[0] === 0xff && buf[1] === 0xd8) return { buf: cleanJpeg(buf), ext: 'jpg' }
  if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return { buf: cleanPng(buf), ext: 'png' }
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return { buf: cleanWebp(buf), ext: 'webp' }
  throw fail('Photos must be JPG, PNG or WebP images')
}
