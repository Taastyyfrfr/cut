/**
 * Concetto Biologico — Dermal Canvas Installation
 * 
 * Master Orchestrator:
 * - Dynamic heightfield trench carving with continuous non-uniform splines
 * - Movable directional gallery spotlight tracking
 * - Dual-material response (dry skin alabaster vs wet viscera/arterial crimson)
 * - Viscous fluid pooling & capillary wicking
 * - Procedural Web Audio synthesis
 * - Keyboard shortcuts: [Space] Regenerate, [S] Export capture, [M] Audio, [F] Fullscreen
 */

import './style.css';
import { AudioEngine } from './audio/audioEngine';
import { Heightfield } from './engine/heightfield';
import { CanvasRenderer } from './engine/renderer';

class BiologicalCanvasApp {
  private audioEngine: AudioEngine;
  private heightfield: Heightfield;
  private canvasRenderer: CanvasRenderer;

  // DOM Elements
  private container: HTMLElement;
  private scalpelCursor: HTMLElement | null;
  private toastElement: HTMLElement | null;
  private regenFlash: HTMLElement | null;

  // Interaction State
  private isPointerDown: boolean = false;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;
  private toastTimeout: number = 0;
  private idleTimer: number = 0;

  // Frame timing
  private lastFrameTime: number = performance.now();

  constructor() {
    this.container = document.getElementById('canvas-container')!;
    this.scalpelCursor = document.getElementById('scalpel-cursor');
    this.toastElement = document.getElementById('toast');
    this.regenFlash = document.getElementById('regen-flash');

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Initialize systems
    this.audioEngine = new AudioEngine();
    this.heightfield = new Heightfield(width, height);
    this.canvasRenderer = new CanvasRenderer(this.container, this.heightfield);

    this.bindEvents();
    this.startRenderLoop();
    this.resetIdleTimer();
  }

  private bindEvents(): void {
    // Window Resize
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.canvasRenderer.resize(w, h);
    });

    // High-precision pointer events
    window.addEventListener('pointerdown', (e: PointerEvent) => this.onPointerDown(e), { passive: false });
    window.addEventListener('pointermove', (e: PointerEvent) => this.onPointerMove(e), { passive: false });
    window.addEventListener('pointerup', (e: PointerEvent) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e: PointerEvent) => this.onPointerUp(e));

    // Prevent default touch scrolling/gestures
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e: KeyboardEvent) => this.onKeyDown(e));

    // Idle tracking
    window.addEventListener('mousemove', () => this.resetIdleTimer());
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    this.isPointerDown = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    // Unlock Web Audio API on first user gesture
    this.audioEngine.resumeIfNeeded();

    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 1.0;
    this.heightfield.beginSlice(e.clientX, e.clientY, pressure);

    document.body.classList.add('slicing');
    this.scalpelCursor?.classList.add('cutting');

    this.resetIdleTimer();
  }

  private onPointerMove(e: PointerEvent): void {
    const x = e.clientX;
    const y = e.clientY;

    // Update gallery directional light position in shader
    const normX = x / window.innerWidth;
    const normY = y / window.innerHeight;
    this.canvasRenderer.setPointerPosition(normX, normY);

    // Update custom scalpel cursor
    if (this.scalpelCursor) {
      this.scalpelCursor.style.left = `${x}px`;
      this.scalpelCursor.style.top = `${y}px`;

      const dx = x - this.lastPointerX;
      const dy = y - this.lastPointerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 3) {
        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 45;
        this.scalpelCursor.style.transform = `translate(-4px, -28px) rotate(${angleDeg}deg)`;
      }
    }

    // Carve trench into heightfield dynamically
    if (this.isPointerDown) {
      const pressure = e.pressure && e.pressure > 0 ? e.pressure : 1.0;
      const sliceInfo = this.heightfield.addSlicePoint(x, y, pressure);

      if (sliceInfo) {
        // Continuous scalpel shearing friction acoustics
        this.audioEngine.updateSlice(sliceInfo.velocity, pressure);
      }
    }

    this.lastPointerX = x;
    this.lastPointerY = y;
    this.resetIdleTimer();
  }

  private onPointerUp(_e: PointerEvent): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;

    // Stop blade friction sound
    this.audioEngine.stopSlice();

    // Finalize trench & generate bridging connective strands
    this.heightfield.endSlice();

    // Visceral membrane tension release thump
    this.audioEngine.playTensionRelease(1.25);

    document.body.classList.remove('slicing');
    this.scalpelCursor?.classList.remove('cutting');
    this.resetIdleTimer();
  }

  private onKeyDown(e: KeyboardEvent): void {
    // [Space] Regenerate / wipe taut membrane
    if (e.code === 'Space') {
      e.preventDefault();
      this.regenerateCanvas();
    }
    // [S] Export high-resolution frame capture
    else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      this.exportHighResCapture();
    }
    // [M] Mute / Unmute Audio
    else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      const isMuted = this.audioEngine.toggleMute();
      this.showToast(isMuted ? 'Acoustics: Muted' : 'Acoustics: Active');
    }
    // [F] Fullscreen toggle for gallery exhibition mode
    else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      this.toggleFullscreen();
    }
  }

  /**
   * Regenerate canvas: reset heightfield to pristine state with subtle flash
   */
  private regenerateCanvas(): void {
    this.heightfield.clear();
    this.audioEngine.playRegeneration();

    if (this.regenFlash) {
      this.regenFlash.classList.add('flash');
      setTimeout(() => {
        this.regenFlash?.classList.remove('flash');
      }, 80);
    }

    this.showToast('Membrane Regenerated');
  }

  /**
   * Export high-resolution PNG frame capture
   */
  private exportHighResCapture(): void {
    this.canvasRenderer.exportCapture();
    this.showToast('High-Resolution Frame Exported');
  }

  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      this.showToast('Gallery Mode: Fullscreen');
    } else {
      document.exitFullscreen().catch(() => {});
      this.showToast('Windowed Mode');
    }
  }

  private showToast(message: string): void {
    if (!this.toastElement) return;
    this.toastElement.textContent = message;
    this.toastElement.classList.add('visible');

    window.clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => {
      this.toastElement?.classList.remove('visible');
    }, 2400);
  }

  private resetIdleTimer(): void {
    document.body.classList.remove('idle');
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      document.body.classList.add('idle');
    }, 4000);
  }

  private startRenderLoop(): void {
    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - this.lastFrameTime) / 1000, 0.05);
      this.lastFrameTime = currentTime;

      // 1. Step viscous fluid mechanics (pooling, gravity flow, capillary wicking)
      this.heightfield.updateFluidPhysics(dt);

      // 2. Render WebGL scene with dynamic normal mapping and dual-material shading
      this.canvasRenderer.render(currentTime / 1000);

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

// Launch application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new BiologicalCanvasApp();
});
