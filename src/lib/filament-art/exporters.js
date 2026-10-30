import { validateMesh } from './meshGenerator.js';
export function binaryStl(mesh) {
  validateMesh(mesh);
  const count = mesh.indices.length / 3, buffer = new ArrayBuffer(84 + count * 50), view = new DataView(buffer);
  view.setUint32(80,count,true);
  for (let i = 0; i < count; i++) {
    const vertices = Array.from(mesh.indices.slice(i*3,i*3+3), k => Array.from(mesh.positions.slice(k*3,k*3+3)));
    const [a,b,c] = vertices, u = b.map((v,j) => v-a[j]), v = c.map((v,j) => v-a[j]);
    const n = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]], length = Math.hypot(...n);
    [...n.map(v => v/length),...vertices.flat()].forEach((v,j) => view.setFloat32(84+i*50+j*4,v,true));
  }
  return buffer;
}
const encoder = new TextEncoder();
function crc32(bytes) {
  let crc = -1;
  for (const b of bytes) { crc ^= b; for (let i=0;i<8;i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ -1) >>> 0;
}
// ZIP STORE, deterministic headers, no dependencies or proprietary slicer metadata.
export function zipStore(files) {
  const chunks = [], central = []; let offset = 0, centralLength = 0;
  for (const [path,text] of Object.entries(files)) {
    const name = encoder.encode(path), data = encoder.encode(text), crc = crc32(data);
    const local = new Uint8Array(30+name.length), l = new DataView(local.buffer);
    l.setUint32(0,0x04034b50,true); l.setUint16(4,20,true); l.setUint16(12,33,true);
    l.setUint32(14,crc,true); l.setUint32(18,data.length,true); l.setUint32(22,data.length,true); l.setUint16(26,name.length,true); local.set(name,30);
    const entry = new Uint8Array(46+name.length), e = new DataView(entry.buffer);
    e.setUint32(0,0x02014b50,true); e.setUint16(4,20,true); e.setUint16(6,20,true); e.setUint16(14,33,true);
    e.setUint32(16,crc,true); e.setUint32(20,data.length,true); e.setUint32(24,data.length,true); e.setUint16(28,name.length,true); e.setUint32(42,offset,true); entry.set(name,46);
    chunks.push(local,data); central.push(entry); offset += local.length+data.length; centralLength += entry.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true); e.setUint16(8,central.length,true); e.setUint16(10,central.length,true); e.setUint32(12,centralLength,true); e.setUint32(16,offset,true);
  const output = new Uint8Array(offset+centralLength+22); let at=0;
  for (const chunk of [...chunks,...central,end]) { output.set(chunk,at); at += chunk.length; }
  return output;
}
export function geometricThreeMf(mesh) {
  validateMesh(mesh);
  let vertices = '', triangles = '';
  for (let i=0;i<mesh.positions.length;i+=3) vertices += `<vertex x="${mesh.positions[i]}" y="${mesh.positions[i+1]}" z="${mesh.positions[i+2]}"/>`;
  for (let i=0;i<mesh.indices.length;i+=3) triangles += `<triangle v1="${mesh.indices[i]}" v2="${mesh.indices[i+1]}" v3="${mesh.indices[i+2]}"/>`;
  return zipStore({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
    '3D/3dmodel.model': `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`,
  });
}
export function download(data,name,type='application/octet-stream') {
  const url = URL.createObjectURL(new Blob([data],{type})), link = document.createElement('a');
  link.href=url; link.download=name; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
