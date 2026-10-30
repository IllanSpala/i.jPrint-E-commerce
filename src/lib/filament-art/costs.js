// No commercial defaults: unknown slicer time makes the final quote unavailable.
export function estimateCosts({volumeMm3,transitions},rates,slicer=null) {
  const fields=['densityGcm3','materialPerKg','purgeGramsPerChange','energyKwhPrice','averagePowerW','laborPerHour','finishingMinutes','packaging','margin'];
  if (!Number.isFinite(volumeMm3) || volumeMm3<=0 || !Number.isInteger(transitions) || transitions<0 || !rates || fields.some(k=>!Number.isFinite(rates[k]) || rates[k]<0) || rates.densityGcm3<=0 || rates.margin>=1) throw new Error('Informe os custos reais, densidade e margem entre 0 e 1.');
  const geometryGrams=volumeMm3/1000*rates.densityGcm3,purgeGrams=transitions*rates.purgeGramsPerChange;
  const material=(geometryGrams+purgeGrams)/1000*rates.materialPerKg;
  const finishing=rates.finishingMinutes/60*rates.laborPerHour;
  const knownTime=slicer?.validated===true && Number.isFinite(slicer.hours) && slicer.hours>0;
  const energy=knownTime?slicer.hours*rates.averagePowerW/1000*rates.energyKwhPrice:null;
  return {geometryGrams,purgeGrams,material,finishing,packaging:rates.packaging,energy,slicerHours:knownTime?slicer.hours:null,subtotalWithoutEnergy:material+finishing+rates.packaging,estimatedPrice:knownTime?(material+finishing+rates.packaging+energy)/(1-rates.margin):null};
}
