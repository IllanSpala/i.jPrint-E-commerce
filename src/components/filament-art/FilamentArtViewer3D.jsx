import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { baseHeight, zAt } from '../../lib/filament-art/opticalModel.js';
export default function FilamentArtViewer3D({ result, plan, layer }) {
  const host = useRef(null), reset = useRef(() => {}), [error,setError] = useState('');
  useEffect(() => {
    const container = host.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({antialias:true}); } catch { setError('Visualização 3D indisponível neste navegador. Use a prévia 2D.'); return; }
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#202124');
    const camera = new THREE.PerspectiveCamera(38,1,.01,2000); camera.up.set(0,0,1);
    const controls = new OrbitControls(camera,renderer.domElement);
    reset.current = front => { camera.position.set(0,front ? 0 : -plan.heightMm,Math.max(plan.widthMm,plan.heightMm)*1.8); camera.lookAt(0,0,0); controls.target.set(0,0,0); controls.update(); };
    reset.current(false);
    renderer.setPixelRatio(Math.min(devicePixelRatio,2)); container.appendChild(renderer.domElement);
    const geometry = new THREE.BufferGeometry(), positions = result.mesh.positions.slice(), colors = new Float32Array(positions.length);
    for (let i=0;i<positions.length;i+=3) {
      positions[i] -= plan.widthMm/2; positions[i+1] -= plan.heightMm/2;
      positions[i+2] = Math.min(positions[i+2],zAt(plan,layer));
      const k = Math.max(0,Math.min(layer,Math.round((positions[i+2]-baseHeight(plan))/plan.layerMm)));
      colors.set(result.palette[k].linear,i);
    }
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    geometry.setIndex(new THREE.BufferAttribute(result.mesh.indices,1)); geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,metalness:0});
    scene.add(new THREE.Mesh(geometry,material)); scene.add(new THREE.AmbientLight(0xffffff,1.6));
    const light = new THREE.DirectionalLight(0xffffff,2); light.position.set(0,-30,100); scene.add(light);
    const render = () => renderer.render(scene,camera);
    const observer = new ResizeObserver(() => { const w = container.clientWidth, h=container.clientHeight; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); render(); });
    observer.observe(container); controls.addEventListener('change',render);
    return () => { observer.disconnect(); controls.dispose(); geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
  },[result,plan,layer]);
  return <div><div className="h-80 w-full" ref={host}/>{error && <p role="alert">{error}</p>}<div className="flex gap-3 text-xs"><button type="button" onClick={() => reset.current(true)}>Vista frontal</button><button type="button" onClick={() => reset.current(false)}>Vista inclinada / reset</button></div><p className="mt-2 text-xs text-zinc-400">Arraste para girar; use a roda ou dois dedos para ampliar. A iluminação altera a aparência; compare cores na prévia 2D.</p></div>;
}
