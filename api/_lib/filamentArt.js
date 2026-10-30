import { createHash } from 'node:crypto';
import { inspectImage } from '../../src/lib/filament-art/imagePipeline.js';
import { BUCKET, fitsProduct, isFilamentProduct, validProjectRef } from '../../src/lib/filament-art/projectSerializer.js';
export async function validateFilamentProjects(db, userId, items) {
  const selected = items.filter(i => i.filamentArt);
  const projects = new Map();
  if (!selected.length) return projects;
  for (const item of selected) if (!isFilamentProduct(item) || !validProjectRef(item.filamentArt)) throw Object.assign(new Error('Referência de quadro inválida.'),{status:400});
  const { data, error } = await db.from('filament_art_projects').select('id,user_id,product_id,hash,original_path,summary').in('id',selected.map(i => i.filamentArt.id)).eq('user_id',userId);
  if (error) throw Object.assign(new Error('Não foi possível recuperar a personalização.'),{status:503});
  for (const item of selected) {
    const project = data?.find(p => p.id === item.filamentArt.id && p.user_id === userId && String(p.product_id) === String(item.id) && p.hash === item.filamentArt.hash);
    if (!project) throw Object.assign(new Error('Personalização indisponível para esta conta.'),{status:403});
    if (projects.has(project.id)) continue;
    const original = project.original_path && await db.storage.from(BUCKET).download(project.original_path);
    if (!original || original.error || !original.data) throw Object.assign(new Error('A foto original do HueForge não está disponível. Reenvie a imagem antes de finalizar o pedido.'),{status:409});
    const bytes = new Uint8Array(await original.data.arrayBuffer());
    try { inspectImage(bytes); } catch { throw Object.assign(new Error('A foto original do HueForge está inválida. Reenvie a imagem.'),{status:409}); }
    if (project.summary.originalFile?.sha256 && createHash('sha256').update(bytes).digest('hex') !== project.summary.originalFile.sha256) throw Object.assign(new Error('A foto original do HueForge foi alterada. Reenvie a imagem.'),{status:409});
    projects.set(project.id,{ id: project.id, hash: project.hash, ...project.summary });
  }
  return projects;
}
export function checkCommercialPlan(ref, product) {
  if (ref && !fitsProduct(ref.plan,product)) throw Object.assign(new Error('As medidas do quadro não correspondem ao produto. Solicite um orçamento para outro tamanho.'),{status:400});
}
