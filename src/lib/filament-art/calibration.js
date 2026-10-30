import { hexLinear, lab, deltaE00 } from './colorSpaces.js';
import { compose, A1, virtualPalette, printManifest } from './opticalModel.js';
import { generateMesh } from './meshGenerator.js';
// Fit one front-lit hiding coefficient per RGB channel from measured swatches.
// A measurement is {thicknessMm, lowerHex, measuredHex}; hex is sRGB under
// controlled front illumination. This is NOT a conversion from backlit TD.
export function fitHidingDistance(profile, samples) {
  if (!Array.isArray(samples) || samples.length < 3 || samples.length > 100) throw new Error('Use de 3 a 100 medições com espessuras conhecidas.');
  const target = hexLinear(profile.hex);
  const records = samples.map(s => {
    if (!Number.isFinite(s.thicknessMm) || s.thicknessMm <= 0 || s.thicknessMm > 10) throw new Error('Espessura de calibração inválida.');
    return {t:s.thicknessMm,lower:hexLinear(s.lowerHex),observed:hexLinear(s.measuredHex)};
  });
  if (new Set(records.map(r=>r.t)).size < 3) throw new Error('Meça ao menos três espessuras diferentes.');
  const coefficients = [0,1,2].map(c => {
    if (records.every(r => Math.abs(r.lower[c]-target[c]) < .02)) throw new Error('Substrato sem contraste suficiente para identificar todos os canais.');
    const cost = log => records.reduce((sum,r) => { const t=10**(-r.t/Math.exp(log)); return sum + (target[c]*(1-t)+r.lower[c]*t-r.observed[c])**2; },0);
    // Global bounded grid first, then refine the best interval in log-space.
    const low=Math.log(.01), high=Math.log(100), step=(high-low)/200;
    let best=0,score=Infinity;
    for(let i=0;i<=200;i++){const value=cost(low+i*step);if(value<score){score=value;best=i;}}
    let a=low+Math.max(0,best-1)*step,b=low+Math.min(200,best+1)*step;
    for(let i=0;i<60;i++){const x=a+(b-a)/3,y=b-(b-a)/3;if(cost(x)<cost(y))b=y;else a=x;}
    return Math.exp((a+b)/2);
  });
  const fitted={...profile,hidingDistanceRgbMm:coefficients};
  const meanDeltaE00=records.reduce((sum,r)=>sum+deltaE00(lab(compose(r.lower,fitted,r.t)),lab(r.observed)),0)/records.length;
  return {hidingDistanceRgbMm:coefficients,meanDeltaE00,samples:structuredClone(samples),requiresAdminConfirmation:true};
}
// Test coupon uses one chosen material over its own base. For fitting against a
// contrasting substrate, print the supplied manifest with the chosen base spool.
export function calibrationCoupon(baseProfile, topProfile) {
  const plan={...A1,widthMm:85,heightMm:20,artLayers:16};
  const profiles=[baseProfile,topProfile];
  if(baseProfile.id===topProfile.id)throw new Error('Escolha bobinas distintas para base e amostra.');
  // Explicit schedule: base material only in base, sample material from first art layer.
  let lower=compose([1,1,1],baseProfile,plan.firstLayerMm+(plan.baseLayers-1)*plan.layerMm);
  const palette=virtualPalette(plan,profiles);
  palette[0].filamentId=baseProfile.id;
  for(let k=1;k<=16;k++){
    lower=compose(lower,topProfile,plan.layerMm);
    palette[k]={...palette[k],filamentId:topProfile.id,linear:lower.slice()};
  }
  const map=Uint8Array.from({length:34},(_,i)=>i%17),manifest=printManifest(plan,profiles,palette);
  return {mesh:generateMesh({width:17,height:2,map,manifest},plan),manifest:{...manifest,purpose:'calibration coupon',columns:Array.from({length:17},(_,k)=>({column:k+1,topThicknessMm:k*plan.layerMm}))}};
}
