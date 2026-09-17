/* Minimal ZIP STORE writer that keeps directory paths (used only for bundles). */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function zipEntries(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    if (!/^[A-Za-z0-9_./-]+$/.test(name) || name.includes('..') || name.startsWith('/')) {
      throw new Error(`Unsafe entry name: ${name}`);
    }
    const n = Buffer.from(name, 'utf8');
    const b = Buffer.from(data);
    const crc = crc32(b);
    const isDir = name.endsWith('/');
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4);
    h.writeUInt16LE(33, 12); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(b.length, 18); h.writeUInt32LE(b.length, 22);
    h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6);
    c.writeUInt16LE(33, 14); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(b.length, 20); c.writeUInt32LE(b.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    if (isDir) {
      h.writeUInt32LE(0x10, 6);
      c.writeUInt32LE(0x10, 38);
    }
    parts.push(h, n, b);
    central.push(c, n);
    offset += h.length + n.length + b.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}
