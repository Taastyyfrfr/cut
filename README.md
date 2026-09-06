# Concetto Biologico — Dermal Canvas

> Minimalist contemporary art installation where pointer input incises into an organic, biological vellum membrane with tactile membrane tension physics, dynamic heightfield normal mapping, and viscous fluid mechanics.

Inspired by **Lucio Fontana** (*Concetto Spaziale: Attese*) meeting visceral biological dermis.

---

## Visual & Technical Architecture

1. **Dynamic Heightfield & Normal Mapping**:
   - Continuous non-uniform spline carving directly into a numerical simulation grid (`Float32Array`).
   - Micro-perturbed baseline with procedural skin pores and dermatoglyphic creases.
   - Steep trench cross-section profile with raised, curled lip margins and needle-thin parabolic endpoints.
   - Real-time surface normal recomputation on the GPU via central finite differences.

2. **Dual-Material Physically Based Shading**:
   - **Dry Skin / Vellum**: Roughness ~0.95. Muted powdery alabaster tone (`#E8DFD8`), soft Lambertian wrap, and warm reddish subsurface scattering (SSS) bleeding around backlit grazing angles.
   - **Wet Viscera & Liquid Blood**: Roughness ~0.05. Sharp Blinn-Phong specular gloss ($n=420$), Schlick Fresnel sheen, and contact ambient occlusion deep in crevices.

3. **Incision Anatomy & Connective Strands**:
   - Velocity-modulated cut width.
   - Procedural quivering collagen strands bridging across the gaping wound.
   - Contact ambient occlusion darkening the deep crevice void.

4. **Viscous Fluid Mechanics**:
   - Deep arterial crimson (`#7A0C16`) transitioning via Beer-Lambert absorption to clotted, near-black burgundy (`#220508`).
   - Viscous crevice pooling, gravity dripping rivulets, and irregular capillary wicking into cold-press vellum fibers.

5. **Procedural Web Audio API Acoustics**:
   - Scalpel shearing friction modulated by cutting velocity.
   - Visceral membrane tension release snap ($140\text{Hz} \to 35\text{Hz}$ damped sweep).
   - Capillary micro-droplets and gentle clinical gallery room tone.

---

## Controls & Shortcuts

| Control | Action |
|---|---|
| **Pointer Drag** | Incise the membrane with surgical scalpel |
| <kbd>Space</kbd> | Regenerate canvas with pristine vellum wipe |
| <kbd>S</kbd> | Export high-resolution lossless PNG capture |
| <kbd>M</kbd> | Toggle audio synthesis |
| <kbd>F</kbd> | Toggle fullscreen exhibition mode |

---

## Getting Started

### Windows One-Click:
- Double-click `start.bat` to launch the server and open the browser.
- Double-click `stop.bat` to terminate the running server.

### Manual Setup:
```bash
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.
