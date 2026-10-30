// CIELAB K-means with deterministic farthest-point seeds and population weighting.
export function quantizeLab(colors, count, iterations = 6) {
  if (!Number.isInteger(count) || count < 2 || count > 32) throw new Error('Quantização: use 2 a 32 cores.');
  const distance = (a,b) => a.reduce((s,v,c)=>s+(v-b[c])**2,0);
  const sample=colors.filter((_,i)=>i%Math.max(1,Math.ceil(colors.length/1024))===0);
  if(!sample.length)return [];
  const centers=[sample[0].slice()];
  while(centers.length<count){let best=sample[0],score=-1;for(const color of sample){const d=Math.min(...centers.map(c=>distance(c,color)));if(d>score){score=d;best=color;}}centers.push(best.slice());}
  const nearest=color=>{let best=0,score=Infinity;centers.forEach((c,i)=>{const d=distance(c,color);if(d<score){score=d;best=i;}});return best;};
  for(let round=0;round<iterations;round++){
    const sums=centers.map(()=>[0,0,0,0]);
    for(const color of sample){const sum=sums[nearest(color)];for(let c=0;c<3;c++)sum[c]+=color[c];sum[3]++;}
    sums.forEach((s,i)=>{if(s[3])centers[i]=s.slice(0,3).map(v=>v/s[3]);});
  }
  return colors.map(color=>centers[nearest(color)].slice());
}
export function filterRaster(raster, noise = 0, sharpness = 0) {
  const {width,height,data}=raster, output=new Uint8ClampedArray(data);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=(y*width+x)*4;
    for(let c=0;c<3;c++){
      let sum=0,weight=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=Math.max(0,Math.min(width-1,x+dx)),ny=Math.max(0,Math.min(height-1,y+dy)),q=(ny*width+nx)*4;
        // Bilateral range gate retains high-contrast contours and ignores alpha holes.
        if(data[q+3]===0 || Math.abs(data[p]-data[q])+Math.abs(data[p+1]-data[q+1])+Math.abs(data[p+2]-data[q+2])>100)continue;
        const w=dx===0 && dy===0?4:1;sum+=data[q+c]*w;weight+=w;
      }
      const smooth=weight?sum/weight:data[p+c];
      output[p+c]=data[p+c]+(smooth-data[p+c])*noise+(data[p+c]-smooth)*sharpness;
    }
  }
  return output;
}
