/**
 * Procedural Audio Engine for Biological Canvas Installation
 * Generates tactile scalpel incision sounds, membrane tension release snaps,
 * viscous capillary seepage, and subtle clinical gallery room ambience.
 */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Master bus
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  // Continuous cutting sound nodes
  private sliceNoiseNode: AudioBufferSourceNode | null = null;
  private sliceFilter: BiquadFilterNode | null = null;
  private sliceResonance: BiquadFilterNode | null = null;
  private sliceGain: GainNode | null = null;
  private isCutting: boolean = false;

  // Ambience nodes
  private ambientGain: GainNode | null = null;
  private subOsc1: OscillatorNode | null = null;
  private subOsc2: OscillatorNode | null = null;

  // Noise buffers cache
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;

  // Seepage drip throttler
  private lastDripTime: number = 0;

  constructor() {
    // Initialized lazily on first user interaction
  }

  public init(): void {
    if (this.isInitialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master bus with warm mastering compression
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(3.5, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      this.generateNoiseBuffers();
      this.setupAmbience();
      this.setupSliceSynth();

      this.isInitialized = true;
    } catch (err) {
      console.warn('Web Audio initialization error:', err);
    }
  }

  public resumeIfNeeded(): void {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private generateNoiseBuffers(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferLength = sampleRate * 3; // 3 seconds looped

    // White noise
    this.whiteNoiseBuffer = this.ctx.createBuffer(1, bufferLength, sampleRate);
    const whiteData = this.whiteNoiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferLength; i++) {
      whiteData[i] = Math.random() * 2 - 1;
    }

    // Pink noise (1/f) for warm biological friction
    this.pinkNoiseBuffer = this.ctx.createBuffer(1, bufferLength, sampleRate);
    const pinkData = this.pinkNoiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferLength; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }

  private setupAmbience(): void {
    if (!this.ctx || !this.masterGain) return;

    // Ultra-quiet clinical gallery room tone (50Hz sub + gentle air texture)
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    // Drone 1: 52Hz deep warmth
    this.subOsc1 = this.ctx.createOscillator();
    this.subOsc1.type = 'sine';
    this.subOsc1.frequency.setValueAtTime(52, this.ctx.currentTime);

    // Drone 2: 78Hz fifth harmonic
    this.subOsc2 = this.ctx.createOscillator();
    this.subOsc2.type = 'sine';
    this.subOsc2.frequency.setValueAtTime(78.2, this.ctx.currentTime);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    this.subOsc1.connect(subGain);
    this.subOsc2.connect(subGain);
    subGain.connect(this.ambientGain);

    // Subtle filtered room air
    if (this.pinkNoiseBuffer) {
      const airNoise = this.ctx.createBufferSource();
      airNoise.buffer = this.pinkNoiseBuffer;
      airNoise.loop = true;

      const airFilter = this.ctx.createBiquadFilter();
      airFilter.type = 'lowpass';
      airFilter.frequency.setValueAtTime(180, this.ctx.currentTime);
      airFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

      const airGain = this.ctx.createGain();
      airGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      airNoise.connect(airFilter);
      airFilter.connect(airGain);
      airGain.connect(this.ambientGain);
      airNoise.start();
    }

    this.ambientGain.connect(this.masterGain);
    this.subOsc1.start();
    this.subOsc2.start();
  }

  private setupSliceSynth(): void {
    if (!this.ctx || !this.masterGain || !this.pinkNoiseBuffer) return;

    // Continuous blade friction generator
    this.sliceNoiseNode = this.ctx.createBufferSource();
    this.sliceNoiseNode.buffer = this.pinkNoiseBuffer;
    this.sliceNoiseNode.loop = true;

    this.sliceFilter = this.ctx.createBiquadFilter();
    this.sliceFilter.type = 'bandpass';
    this.sliceFilter.frequency.setValueAtTime(3200, this.ctx.currentTime);
    this.sliceFilter.Q.setValueAtTime(2.2, this.ctx.currentTime);

    this.sliceResonance = this.ctx.createBiquadFilter();
    this.sliceResonance.type = 'highpass';
    this.sliceResonance.frequency.setValueAtTime(1400, this.ctx.currentTime);
    this.sliceResonance.Q.setValueAtTime(1.0, this.ctx.currentTime);

    this.sliceGain = this.ctx.createGain();
    this.sliceGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.sliceNoiseNode.connect(this.sliceResonance);
    this.sliceResonance.connect(this.sliceFilter);
    this.sliceFilter.connect(this.sliceGain);
    this.sliceGain.connect(this.masterGain);

    this.sliceNoiseNode.start();
  }

  /**
   * Called continuously while slicing.
   * @param velocity Pixel speed of scalpel movement (0 to ~2500)
   * @param depth Current penetration depth (0 to 1)
   */
  public updateSlice(velocity: number, depth: number = 0.8): void {
    if (!this.ctx || !this.sliceGain || !this.sliceFilter) return;

    const normVel = Math.min(Math.max(velocity / 1200, 0), 1.5);
    const now = this.ctx.currentTime;

    if (normVel > 0.02) {
      this.isCutting = true;
      // Scalpel shearing friction volume
      const targetGain = Math.min(normVel * 0.45 * depth, 0.55);
      this.sliceGain.gain.cancelScheduledValues(now);
      this.sliceGain.gain.setTargetAtTime(targetGain, now, 0.02);

      // Filter sweeps higher with faster cuts (crisp razor edge)
      const targetFreq = 2200 + normVel * 3800;
      this.sliceFilter.frequency.cancelScheduledValues(now);
      this.sliceFilter.frequency.setTargetAtTime(targetFreq, now, 0.03);

      // Occasionally trigger subtle wet capillary micro-clicks during deep cuts
      if (Math.random() < 0.12 * normVel && now - this.lastDripTime > 0.08) {
        this.playCapillarySquelch(0.25 * depth);
        this.lastDripTime = now;
      }
    } else {
      this.stopSlice();
    }
  }

  /**
   * Stop cutting friction
   */
  public stopSlice(): void {
    if (!this.ctx || !this.sliceGain || !this.isCutting) return;
    const now = this.ctx.currentTime;
    this.sliceGain.gain.cancelScheduledValues(now);
    this.sliceGain.gain.setTargetAtTime(0.0, now, 0.05);
    this.isCutting = false;
  }

  /**
   * Visceral low-frequency membrane tension release thump
   * Triggered when skin snaps open along cut perimeter
   */
  public playTensionRelease(intensity: number = 1.0): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Sub thump: downward swept sine wave
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = 135 + Math.random() * 25;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);

    const gainVal = Math.min(0.42 * intensity, 0.6);
    oscGain.gain.setValueAtTime(gainVal, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.28);

    // Snapping parchment click
    if (this.whiteNoiseBuffer) {
      const snapNoise = this.ctx.createBufferSource();
      snapNoise.buffer = this.whiteNoiseBuffer;

      const snapFilter = this.ctx.createBiquadFilter();
      snapFilter.type = 'bandpass';
      snapFilter.frequency.setValueAtTime(1200 + Math.random() * 400, now);
      snapFilter.Q.setValueAtTime(4.0, now);

      const snapGain = this.ctx.createGain();
      snapGain.gain.setValueAtTime(0.18 * intensity, now);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

      snapNoise.connect(snapFilter);
      snapFilter.connect(snapGain);
      snapGain.connect(this.masterGain);

      snapNoise.start(now);
      snapNoise.stop(now + 0.08);
    }
  }

  /**
   * Subtle wet capillary squelch / droplet resonance
   */
  public playCapillarySquelch(volume: number = 0.3): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Micro FM droplet
    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const dripGain = this.ctx.createGain();

    const baseFreq = 520 + Math.random() * 480;
    carrier.frequency.setValueAtTime(baseFreq, now);
    carrier.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + 0.06);

    mod.frequency.setValueAtTime(baseFreq * 1.5, now);
    modGain.gain.setValueAtTime(300, now);
    modGain.gain.exponentialRampToValueAtTime(20, now + 0.05);

    mod.connect(carrier.frequency);

    const level = Math.min(volume * 0.22, 0.35);
    dripGain.gain.setValueAtTime(level, now);
    dripGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    carrier.connect(dripGain);
    dripGain.connect(this.masterGain);

    carrier.start(now);
    mod.start(now);
    carrier.stop(now + 0.08);
    mod.stop(now + 0.08);
  }

  /**
   * Resonant low drip when fluid teardrop detaches and runs
   */
  public playFluidDrip(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastDripTime < 0.15) return;
    this.lastDripTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const freq = 650 + Math.random() * 200;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Sound on canvas regeneration / pristine vellum wipe
   */
  public playRegeneration(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.6);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.75);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.75, now, 0.05);
    }
    return this.isMuted;
  }

  public isMute(): boolean {
    return this.isMuted;
  }
}
