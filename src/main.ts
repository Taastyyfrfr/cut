/**
 * Concetto Biologico — Dermal Canvas Installation
 * 
 * Unified Master Application:
 * - High-end visceral gallery installation (Lucio Fontana slash meets biological dermis)
 * - 1:1 Pixel Coordinate Space with strict window.devicePixelRatio support
 * - Dynamic gaping lens incision geometry with 150ms elastic pull
 * - Procedural Web Audio API sound synthesis
 * - Keyboard shortcuts: [Space] Regenerate, [S] Export capture, [M] Audio, [F] Fullscreen
 */

import './style.css';
import { AudioEngine } from './audio/audioEngine';
import { CanvasRenderer } from './engine/renderer';

class BiologicalCanvasApp {
  private audioEngine: AudioEngine;
  private canvasRenderer: CanvasRenderer;

  // DOM Elements
  private container: HTMLElement;
  private scalpelCursor: HTMLElement | null;
  private toastElement: HTMLElement | null;
  private regenFlash: HTMLElement | null;

  // Interaction State
  private toastTimeout: number = 0;
  private idleTimer: number = 0;

  constructor() {
    this.container = document.getElementById('canvas-container')!;
    this.scalpelCursor = document.getElementById('scalpel-cursor');
    this.toastElement = document.getElementById('toast');
    this.regenFlash = document.getElementById('regen-flash');

    // Initialize unified audio and rendering systems
    this.audioEngine = new AudioEngine();
    this.canvasRenderer = new CanvasRenderer(this.container, this.audioEngine);

    this.bindEvents();
    this.resetIdleTimer();
  }

  private bindEvents(): void {
    // Window Resize with high-DPI scaling
    window.addEventListener('resize', () => {
      this.canvasRenderer.resize(window.innerWidth, window.innerHeight);
    });

    // High-precision pointer events
    window.addEventListener('pointerdown', (e: PointerEvent) => this.onPointerDown(e), { passive: false });
    window.addEventListener('pointermove', (e: PointerEvent) => this.onPointerMove(e), { passive: false });
    window.addEventListener('pointerup', (_e: PointerEvent) => this.onPointerUp());
    window.addEventListener('pointercancel', (_e: PointerEvent) => this.onPointerUp());

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

    // Unlock Web Audio API on first user gesture
    this.audioEngine.resumeIfNeeded();

    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 1.0;
    this.canvasRenderer.onPointerDown(e.clientX, e.clientY, pressure);

    document.body.classList.add('slicing');
    this.scalpelCursor?.classList.add('cutting');

    this.resetIdleTimer();
  }

  private onPointerMove(e: PointerEvent): void {
    const x = e.clientX;
    const y = e.clientY;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 1.0;

    // Update custom scalpel cursor
    if (this.scalpelCursor) {
      this.scalpelCursor.style.left = `${x}px`;
      this.scalpelCursor.style.top = `${y}px`;
    }

    const moveInfo = this.canvasRenderer.onPointerMove(x, y, pressure);
    if (moveInfo && this.scalpelCursor) {
      const angleDeg = (moveInfo.angle * 180) / Math.PI + 45;
      this.scalpelCursor.style.transform = `translate(-4px, -28px) rotate(${angleDeg}deg)`;
    }

    this.resetIdleTimer();
  }

  private onPointerUp(): void {
    this.canvasRenderer.onPointerUp();

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
   * Regenerate canvas: reset cuts & fluids with a subtle pristine wipe
   */
  private regenerateCanvas(): void {
    this.canvasRenderer.clear();

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
}

// Launch application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new BiologicalCanvasApp();
});
