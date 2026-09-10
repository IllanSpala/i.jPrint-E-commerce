import { useEffect, useRef } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

function limparGravura(grupo) {
  while (grupo.children.length) {
    const filho = grupo.children.pop();
    filho.traverse((obj) => {
      obj.geometry?.dispose?.();
      obj.material?.dispose?.();
    });
  }
}

function aplicarSvgComoGeometria(grupo, svg, cor) {
  limparGravura(grupo);
  if (!svg) return;
  const resultado = new SVGLoader().parse(svg);
  const conteudo = new THREE.Group();
  resultado.paths.forEach((path) => {
    SVGLoader.createShapes(path).forEach((shape) => {
      const geometry = new THREE.ShapeGeometry(shape, 10);
      const material = new THREE.MeshBasicMaterial({ color: cor, side: THREE.DoubleSide, depthWrite: true, polygonOffset: true, polygonOffsetFactor: -4 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 10;
      conteudo.add(mesh);
    });
  });
  if (!conteudo.children.length) return;
  const caixa = new THREE.Box3().setFromObject(conteudo);
  const tamanho = new THREE.Vector3();
  const centro = new THREE.Vector3();
  caixa.getSize(tamanho);
  caixa.getCenter(centro);
  const normalizacao = 1 / Math.max(tamanho.x, tamanho.y, 1);
  conteudo.position.set(-centro.x * normalizacao, centro.y * normalizacao, 0);
  conteudo.scale.set(normalizacao, -normalizacao, normalizacao);
  grupo.add(conteudo);
}

export default function ModeloStl({ arquivo, corObjeto, corGravura, svg, escala, x, y, povX, povY, capturaRef }) {
  const containerRef = useRef(null);
  const cenaRef = useRef(null);
  const propsRef = useRef(null);
  propsRef.current = { corObjeto, corGravura, svg, escala, x, y, povX, povY };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !arquivo) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
    camera.up.set(0, 0, 1);
    camera.position.set(4.6, 3.7, 5.6);
    camera.lookAt(0, 0.75, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x25211b, 2.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(4, 7, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xe8c98a, 1.5);
    rimLight.position.set(-5, 2, -3);
    scene.add(rimLight);
    const grid = new THREE.GridHelper(12, 24, 0x8a784f, 0x34363b);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.02;
    scene.add(grid);

    const group = new THREE.Group();
    scene.add(group);
    const cubeScene = new THREE.Scene();
    const cubeCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    const cubeMaterials = ["X", "X", "Y", "Y", "Z", "Z"].map((label) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#292c32"; ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = "#858991"; ctx.lineWidth = 3; ctx.strokeRect(1, 1, 126, 126);
      ctx.fillStyle = { X: "#f87171", Y: "#4ade80", Z: "#60a5fa" }[label];
      ctx.font = "bold 52px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, 64, 66);
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map });
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cubeMaterials);
    cubeScene.add(cube);
    const render = () => {
      const width = container.clientWidth, height = container.clientHeight;
      renderer.setViewport(0, 0, width, height);
      renderer.render(scene, camera);
      renderer.autoClear = false;
      renderer.clearDepth();
      cubeCamera.quaternion.copy(camera.quaternion);
      cubeCamera.position.set(0, 0, 4).applyQuaternion(camera.quaternion);
      const side = Math.min(100, width / 4, height / 4);
      // Mesmo centro horizontal dos controles: 120 px de largura, 16 px da borda.
      renderer.setViewport(width - 16 - 60 - side / 2, height - side - 12, side, side);
      renderer.render(cubeScene, cubeCamera);
      renderer.autoClear = true;
    };
    const update = () => {
      const atual = cenaRef.current;
      if (!atual) return;
      const p = propsRef.current;
      const alvo = new THREE.Vector3(0, 0, atual.altura / 2);
      const azimute = THREE.MathUtils.degToRad(42 + (p.povY || 0));
      const elevacao = THREE.MathUtils.degToRad(Math.max(5, Math.min(90, 35 - (p.povX || 0))));
      camera.position.set(7 * Math.sin(azimute) * Math.cos(elevacao), -7 * Math.cos(azimute) * Math.cos(elevacao), alvo.z + 7 * Math.sin(elevacao));
      camera.up.set(-Math.sin(azimute) * Math.sin(elevacao), Math.cos(azimute) * Math.sin(elevacao), Math.cos(elevacao));
      camera.lookAt(alvo);
      atual.mesh?.material.color.set(p.corObjeto);
      if (atual.decal) {
        atual.decal.scale.setScalar((p.escala || 45) / 24);
        atual.decal.position.set((p.x || 0) / 85, -(p.y || 0) / 85, atual.altura / 2 + 0.008);
        const key = `${p.corGravura}:${p.svg}`;
        if (atual.gravuraKey !== key) {
          aplicarSvgComoGeometria(atual.decal, p.svg, p.corGravura);
          atual.gravuraKey = key;
        }
      }
      render();
    };
    cenaRef.current = { scene, camera, renderer, group, mesh: null, decal: null, gravuraKey: "", altura: 1.5, render, update };
    if (capturaRef) capturaRef.current = () => {
      if (!cenaRef.current?.mesh) throw new Error("Aguarde o carregamento do modelo antes de concluir.");
      update();
      const captura = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      captura.setSize(512, 512);
      captura.outputColorSpace = THREE.SRGBColorSpace;
      captura.setClearColor(0x17191d, 1);
      const cameraPreview = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
      cameraPreview.up.set(0, 0, 1);
      // Frente (-Y), elevada em +Z, com o centro da peça no centro da foto.
      const alvo = new THREE.Vector3(0, 0, cenaRef.current.altura / 2);
      cameraPreview.position.set(0, -6.1, alvo.z + 4.6);
      cameraPreview.lookAt(alvo);
      try {
        captura.render(scene, cameraPreview);
        return captura.domElement.toDataURL("image/png");
      } finally {
        captura.dispose();
        captura.forceContextLoss();
      }
    };
    let descartado = false;

    new STLLoader().load(arquivo, (geometry) => {
      if (descartado) return;
      geometry.computeVertexNormals();
      geometry.center();
      geometry.computeBoundingBox();
      const size = new THREE.Vector3();
      geometry.boundingBox.getSize(size);
      const fator = 3.4 / Math.max(size.x, size.y);
      geometry.scale(fator, fator, fator);
      geometry.computeBoundingBox();
      const material = new THREE.MeshStandardMaterial({ color: corObjeto, roughness: 0.42, metalness: 0.05 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      cenaRef.current.mesh = mesh;

      const finalSize = new THREE.Vector3();
      geometry.boundingBox.getSize(finalSize);
      group.position.z = finalSize.z / 2;
      cenaRef.current.altura = finalSize.z;
      const decal = new THREE.Group();
      group.add(decal);
      cenaRef.current.decal = decal;
      update();
    });

    const resize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => {
      descartado = true;
      if (capturaRef) capturaRef.current = null;
      observer.disconnect();
      cenaRef.current = null;
      scene.traverse((obj) => {
        obj.geometry?.dispose?.();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material?.dispose?.();
      });
      renderer.dispose();
      cube.geometry.dispose();
      cubeMaterials.forEach((m) => { m.map.dispose(); m.dispose(); });
      renderer.domElement.remove();
    };
  }, [arquivo]);

  useEffect(() => {
    cenaRef.current?.update();
  }, [corObjeto, corGravura, svg, escala, x, y, povX, povY]);

  return <div ref={containerRef} className="absolute inset-0" aria-label="Modelo 3D do produto" />;
}
