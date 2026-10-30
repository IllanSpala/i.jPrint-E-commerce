import { createHash, randomUUID } from 'node:crypto';
import { bancoServidor, limitarRequisicoes } from './_lib/seguranca.js';
import { processArt } from '../src/lib/filament-art/engine.js';
import { generateMesh, validateMesh } from '../src/lib/filament-art/meshGenerator.js';
import { inspectImage, MAX_FILE_BYTES } from '../src/lib/filament-art/imagePipeline.js';
import { BUCKET, fitsProduct, stableJson, projectSnapshot } from '../src/lib/filament-art/projectSerializer.js';
import { produtoAtivo } from '../src/lib/produtoAtivo.js';
import { validatePlan, A1 } from '../src/lib/filament-art/opticalModel.js';
import { fitHidingDistance } from '../src/lib/filament-art/calibration.js';
import { validateImagePreview } from '../src/lib/filament-art/previewColors.js';
const sha = value => createHash('sha256').update(value).digest('hex');
export function criarHandlerFilamentArt(criarBanco = bancoServidor, limitar = limitarRequisicoes) {
return async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido.'});
  try {
    const db = criarBanco(), token = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({error:'Entre na sua conta para salvar o quadro.'});
    const {data:auth,error:authError} = await db.auth.getUser(token);
    if (authError || !auth?.user) return res.status(401).json({error:'Sessão inválida.'});
    const user = auth.user;
    await limitar(db,`filament-art:${user.id}`,10);
    if (Buffer.byteLength(JSON.stringify(req.body || {})) > 600_000) return res.status(413).json({error:'Projeto muito grande.'});
    if (req.body?.action === 'prepare-original') {
      const { size, type } = req.body;
      if (!Number.isInteger(size) || size < 24 || size > MAX_FILE_BYTES || !['image/png','image/jpeg','image/webp'].includes(type)) return res.status(422).json({error:'Envie PNG, JPEG ou WebP de até 8 MB.'});
      const path = `${user.id}/${randomUUID()}/original`;
      const upload = await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
      if (upload.error) {
        console.error('[filament-art] prepare-original', upload.error.message);
        return res.status(503).json({error:'O armazenamento de imagens está indisponível. Sua prévia foi mantida; tente novamente em instantes.'});
      }
      return res.status(200).json({path,token:upload.data.token});
    }
    if (req.body?.action === 'save-profile') {
      const admin = await db.from('loja_admins').select('user_id').eq('user_id',user.id).maybeSingle();
      if (admin.error || !admin.data) return res.status(403).json({error:'Acesso restrito à administração.'});
      const profile = req.body.profile;
      try {
        validatePlan(A1,[profile]);
        if (!/^[a-z0-9_-]{1,80}$/.test(profile.id) || ['name','manufacturer','line','spoolId'].some(k=>typeof profile[k]!=='string' || !profile[k].trim() || profile[k].length>120)) throw new Error('Informe identificador, nome, fabricante, linha e bobina.');
        if (profile.confidence === 'calibrated') {
          if (['printer','nozzle','layer','surface','lighting','date'].some(k=>!String(profile.calibration?.[k] || '').trim())) throw new Error('Registre todas as condições de calibração.');
          const fit=fitHidingDistance(profile,profile.calibration.samples);
          profile.hidingDistanceRgbMm=fit.hidingDistanceRgbMm;
          profile.calibration.meanDeltaE00=fit.meanDeltaE00;
        } else { profile.confidence='estimated'; delete profile.hidingDistanceRgbMm; }
      } catch(error) { return res.status(422).json({error:error.message}); }
      const saved=await db.from('filament_art_profiles').upsert({id:profile.id,profile,in_stock:profile.inStock===true,updated_at:new Date().toISOString()});
      if(saved.error)throw new Error('Profile save failed');
      return res.status(200).json({profile});
    }
    if (req.body?.action === 'load') {
      const {data:project,error} = await db.from('filament_art_projects').select('*').eq('id',req.body.id).maybeSingle();
      if (error || !project) return res.status(404).json({error:'Projeto não encontrado.'});
      if (project.user_id !== user.id) {
        const admin = await db.from('loja_admins').select('user_id').eq('user_id',user.id).maybeSingle();
        if (admin.error || !admin.data) return res.status(403).json({error:'Acesso restrito.'});
      }
      const artifact = await db.storage.from(BUCKET).download(project.artifact_path);
      if (artifact.error) throw new Error('Artifact unavailable');
      const serialized = await artifact.data.text();
      if (sha(serialized) !== project.hash) throw new Error('Artifact hash mismatch');
      const snapshot = JSON.parse(serialized);
      const original = await db.storage.from(BUCKET).createSignedUrl(project.original_path,300);
      if (original.error) throw new Error('Original unavailable');
      return res.status(200).json({project:snapshot,originalUrl:original.data.signedUrl,originalFile:snapshot.originalFile,summary:project.summary});
    }
    if (req.body?.action !== 'save') return res.status(400).json({error:'Operação inválida.'});
    const {input,originalPath} = req.body;
    if (typeof originalPath !== 'string' || !new RegExp(`^${user.id}/[0-9a-f-]{36}/original$`).test(originalPath)) return res.status(400).json({error:'Arquivo original inválido.'});
    const product = await db.from('produtos').select('*').eq('id',82).maybeSingle();
    if (product.error || !produtoAtivo(product.data) || !fitsProduct(input?.plan || {},product.data)) return res.status(400).json({error:'Estas dimensões precisam de um orçamento próprio. Use o tamanho cadastrado do produto.'});
    if (input?.profiles?.some(p=>p.confidence === 'calibrated')) {
      const registered=await db.from('filament_art_profiles').select('profile,in_stock').in('id',input.profiles.map(p=>p.id));
      if (registered.error || input.profiles.some(p=>p.confidence==='calibrated' && !registered.data?.some(row=>row.in_stock && stableJson(row.profile)===stableJson(p)))) return res.status(409).json({error:'A calibração ou disponibilidade da bobina mudou. Reabra o editor para atualizar a paleta.'});
    }
    let result, validation;
    try {
      if (input?.mode === 'image-preview') {
        validateImagePreview(input);
        result = null;
        validation = { previewOnly: true };
      } else { result = processArt(input); validation = validateMesh(generateMesh(result,input.plan)); }
    }
    catch (error) { return res.status(422).json({error:error.message}); }
    const original = await db.storage.from(BUCKET).download(originalPath);
    if (original.error) return res.status(400).json({error:'Envie a imagem original antes de confirmar.'});
    const bytes = new Uint8Array(await original.data.arrayBuffer());
    let originalMetadata;
    try { originalMetadata = inspectImage(bytes); } catch (error) { return res.status(422).json({error:error.message}); }
    const extension = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp' }[originalMetadata.type];
    const originalName = String(req.body.originalName || 'imagem-original').replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N} _-]/gu, '_').slice(0,120) || 'imagem-original';
    const originalFile = { name: `${originalName}.${extension}`, type: originalMetadata.type, size: bytes.length, sha256: sha(bytes) };
    const snapshot = input.mode === 'image-preview'
      ? { version: 'ijprint-image-preview/1', originalSha256: sha(bytes), originalFile, input }
      : { ...projectSnapshot(input,result,sha(bytes)), originalFile };
    const serialized = stableJson(snapshot), hash = sha(serialized);
    const id = randomUUID(), artifactPath = `${user.id}/${id}/project.json`;
    const upload = await db.storage.from(BUCKET).upload(artifactPath,Buffer.from(serialized),{contentType:'application/json',upsert:false});
    if (upload.error) throw new Error('Upload failed');
    const summary = {version:snapshot.version,originalFile,plan:input.plan,shape:input.shape,colors:input.palette,style:input.adjustments?.style || 'photo',status:input.mode === 'image-preview' ? 'Prévia aprovada' : 'estimativa — revisão de produção necessária',meanDeltaE00:result?.meanDeltaE00,validation};
    const inserted = await db.from('filament_art_projects').insert({id,user_id:user.id,product_id:82,hash,original_path:originalPath,artifact_path:artifactPath,summary});
    if (inserted.error) { await db.storage.from(BUCKET).remove([artifactPath]); throw new Error('Save failed'); }
    return res.status(200).json({id,hash,...summary});
  } catch (error) {
    console.error('[filament-art]', error.message);
    return res.status(error.status || 503).json({error:error.status ? error.message : 'Não foi possível salvar ou recuperar o quadro. Sua prévia foi mantida; tente novamente.'});
  }
};
}
export default criarHandlerFilamentArt();
