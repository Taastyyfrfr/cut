/**
 * Master WebGL Three.js Renderer for Biological Canvas Installation
 * Couples custom GLSL fragment shaders with dynamic heightfield simulation:
 * - Dynamic surface normal mapping from heightfield
 * - Dual-material response (dry alabaster vellum vs wet viscera/blood)
 * - Directional light tracking with soft gallery inertia
 * - Contact ambient occlusion, micro-chromatic aberration, and 0.06 film noise
 */

import * as THREE from 'three';
import { vertexShader, fragmentShader } from '../shaders/masterShader';
import { Heightfield } from './heightfield';

export class CanvasRenderer {
  public container: HTMLElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;
  public material: THREE.ShaderMaterial;
  public quad: THREE.Mesh;

  public heightfield: Heightfield;
  private heightTexture: THREE.CanvasTexture;

  public width: number = window.innerWidth;
  public height: number = window.innerHeight;
  public dpr: number = Math.min(window.devicePixelRatio || 1, 2);

  // Movable gallery directional light position
  private lightTarget: THREE.Vector2 = new THREE.Vector2(0.5, 0.6);
  private currentLight: THREE.Vector2 = new THREE.Vector2(0.5, 0.6);

  constructor(container: HTMLElement, heightfield: Heightfield) {
    this.container = container;
    this.heightfield = heightfield;

    // High-performance WebGL renderer
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true, // required for high-res [S] frame capture
    });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height);
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();

    // Heightfield texture
    this.heightTexture = new THREE.CanvasTexture(this.heightfield.textureCanvas);
    this.heightTexture.minFilter = THREE.LinearFilter;
    this.heightTexture.magFilter = THREE.LinearFilter;
    this.heightTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.heightTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Master shader material
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_resolution: { value: new THREE.Vector2(this.width, this.height) },
        u_time: { value: 0 },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_lightPos: { value: new THREE.Vector3(0.5, 0.6, 0.65) },
        u_heightTexture: { value: this.heightTexture },
      },
      depthWrite: false,
      depthTest: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.quad);
  }

  public setPointerPosition(normX: number, normY: number): void {
    const uvY = 1.0 - normY;
    this.material.uniforms.u_mouse.value.set(normX, uvY);

    // Gallery directional light smoothly tracks pointer with soft inertia
    this.lightTarget.set(normX, uvY);
  }

  public resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h);
    this.material.uniforms.u_resolution.value.set(w, h);

    this.heightfield.resize(w, h);

    this.heightTexture.dispose();
    this.heightTexture = new THREE.CanvasTexture(this.heightfield.textureCanvas);
    this.heightTexture.minFilter = THREE.LinearFilter;
    this.heightTexture.magFilter = THREE.LinearFilter;
    this.material.uniforms.u_heightTexture.value = this.heightTexture;
  }

  public render(time: number): void {
    // Soft light source inertia
    this.currentLight.lerp(this.lightTarget, 0.06);
    this.material.uniforms.u_lightPos.value.set(
      this.currentLight.x,
      this.currentLight.y,
      0.65
    );

    // Update heightfield texture from simulation buffer
    this.heightfield.updateTexture();
    this.heightTexture.needsUpdate = true;

    // Update time uniform
    this.material.uniforms.u_time.value = time;

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Export high-resolution frame capture without any UI overlays
   */
  public exportCapture(filename?: string): void {
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = filename || `concetto-biologico_${timestamp}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
