/**
 * Museum-Grade Dynamic Heightfield & Dual-Material Visceral Master Shader
 * 
 * 1. Smooth Normals: 8-tap Sobel filter on continuous heightfield (no crunchy artifacts)
 * 2. Dual-Material Response:
 *    - Uncut Skin: Base vec3(0.92, 0.88, 0.83), Roughness 0.95, SSS warm crimson bleed
 *    - Cut Interior & Blood: Deep venous burgundy vec3(0.18, 0.02, 0.04), Roughness 0.05, Blinn-Phong specular (shininess 128.0)
 * 3. Color Palette: Deep arterial crimson (#8B0C1A) to clotted burgundy (#58050E). Zero #FF0000.
 * 4. Contact Ambient Occlusion deep in crevices.
 * 5. Screen Space: 0.06 film noise overlay, soft vignette, micro-chromatic aberration on specular highlights.
 */

export const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_mouse;
  uniform vec3 u_lightPos;
  uniform sampler2D u_heightTexture;

  varying vec2 vUv;

  // Film noise hash
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Micro-crease noise
  float microPores(vec2 p) {
    float n1 = hash(floor(p * 0.45));
    float n2 = hash(floor(p * 0.9 + 17.0));
    return (n1 * 0.6 + n2 * 0.4 - 0.5) * 0.015;
  }

  // Decode height from texture R channel [0, 1] -> [-1.0, 1.0]
  float decodeHeight(float byteVal) {
    return byteVal * 2.0 - 1.0;
  }

  // Sample composite surface elevation (height + liquid blood level)
  float getElevation(vec2 uv) {
    vec4 samp = texture2D(u_heightTexture, uv);
    float h = decodeHeight(samp.r);
    float fluid = samp.g * 0.12; // fluid elevation meniscus
    return h + fluid;
  }

  void main() {
    vec2 uv = vUv;
    vec2 pixelCoord = gl_FragCoord.xy;
    vec2 texel = 1.0 / u_resolution;

    // Sample center heightfield attributes
    vec4 sampC = texture2D(u_heightTexture, uv);
    float hC = decodeHeight(sampC.r);
    float fluidC = sampC.g;
    float stainC = sampC.b;
    float strandC = sampC.a;

    // -------------------------------------------------------------
    // 1. Smooth Normal Calculation: 8-tap Sobel Filter
    // Eliminates faceted/crunchy artifacts completely
    // -------------------------------------------------------------
    vec2 e = texel * 2.0;
    float tl = getElevation(uv + vec2(-e.x,  e.y));
    float  l = getElevation(uv + vec2(-e.x,  0.0));
    float bl = getElevation(uv + vec2(-e.x, -e.y));
    float  t = getElevation(uv + vec2( 0.0,  e.y));
    float  b = getElevation(uv + vec2( 0.0, -e.y));
    float tr = getElevation(uv + vec2( e.x,  e.y));
    float  r = getElevation(uv + vec2( e.x,  0.0));
    float br = getElevation(uv + vec2( e.x, -e.y));

    float dX = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
    float dY = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);

    // Subtle micro skin pores
    float pores = microPores(pixelCoord);
    dX += pores * 0.4;
    dY += pores * 0.4;

    float normalStrength = 4.2;
    vec3 normal = normalize(vec3(-dX * normalStrength, -dY * normalStrength, 1.0));

    // -------------------------------------------------------------
    // 2. Movable Directional Light & View Geometry
    // -------------------------------------------------------------
    vec3 lightPos = vec3(u_lightPos.xy, 0.72);
    vec3 fragPos = vec3(uv, (hC + fluidC * 0.12) * 0.08);
    vec3 lightDir = normalize(lightPos - fragPos);
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);

    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotH = max(dot(normal, halfDir), 0.0);
    float NdotV = max(dot(normal, viewDir), 0.0);

    // Gallery ambient fill
    vec3 ambient = vec3(0.12, 0.11, 0.10);

    // -------------------------------------------------------------
    // 3. Contact Ambient Occlusion deep inside cut crevice
    // -------------------------------------------------------------
    float trenchDepth = clamp(-hC, 0.0, 1.0);
    float contactAO = clamp(1.0 - pow(trenchDepth, 1.25) * 0.95, 0.05, 1.0);

    // -------------------------------------------------------------
    // 4. Material 1: Uncut Skin Surface (Roughness 0.95)
    // Base: vec3(0.92, 0.88, 0.83)
    // SSS: dot(N, L) softened with warm crimson bleed
    // -------------------------------------------------------------
    vec3 uncutSkinBase = vec3(0.92, 0.88, 0.83);

    // Curled lip tension blanching (raised lip +5% height)
    float curledLip = clamp(hC * 4.0, 0.0, 1.0);
    uncutSkinBase = mix(uncutSkinBase, vec3(0.96, 0.94, 0.91), curledLip * 0.7);

    // Subsurface scattering wrap & crimson rim bleed
    float sssWrap = pow(clamp(1.0 - NdotV, 0.0, 1.0), 3.0);
    vec3 sssBleed = vec3(0.65, 0.08, 0.05) * sssWrap * 0.45;

    // Soft wrapped Lambertian diffuse for matte skin
    float skinDiffuse = clamp(dot(normal, lightDir) * 0.65 + 0.35, 0.0, 1.0);
    vec3 skinShaded = uncutSkinBase * (skinDiffuse + ambient) + sssBleed;

    // Capillary porous absorption into vellum fibers
    if (stainC > 0.005) {
      vec3 arterialStain = vec3(0.345, 0.020, 0.055); // #58050E
      skinShaded = mix(skinShaded, arterialStain, clamp(stainC * 1.1, 0.0, 0.88));
    }

    // -------------------------------------------------------------
    // 5. Material 2: Cut Interior & Blood (Roughness 0.05)
    // Base: deep venous burgundy vec3(0.18, 0.02, 0.04)
    // Palette strictly mapped between #58050E and #8B0C1A (NO #FF0000)
    // -------------------------------------------------------------
    vec3 arterialCrimson = vec3(0.545, 0.047, 0.102); // #8B0C1A
    vec3 clottedBurgundy = vec3(0.345, 0.020, 0.055); // #58050E
    vec3 deepVenousBase  = vec3(0.180, 0.020, 0.040); // User specified deep venous burgundy

    // Blood depth modulation: thin films = arterial, deep crevice/pools = clotted venous
    vec3 bloodTone = mix(arterialCrimson, clottedBurgundy, smoothstep(0.1, 0.7, fluidC + trenchDepth * 0.5));
    vec3 visceraColor = mix(deepVenousBase, bloodTone, clamp(fluidC * 1.8, 0.0, 1.0));

    // Dark contact ambient occlusion inside the trench
    visceraColor *= contactAO;

    // -------------------------------------------------------------
    // 6. Connective Tissue Strands (Collagen bridging the gap)
    // -------------------------------------------------------------
    if (strandC > 0.01) {
      vec3 collagenStrandColor = vec3(0.82, 0.74, 0.76); // Muted fibrous pink-ivory
      collagenStrandColor *= (NdotL * 0.75 + 0.25);
      visceraColor = mix(visceraColor, collagenStrandColor, clamp(strandC * 0.85, 0.0, 0.95));
    }

    // Blend between Dry Skin and Wound Interior based on trench depth & fluid presence
    float isWound = smoothstep(0.04, 0.22, trenchDepth);
    float isWet = max(isWound * 0.92, clamp(fluidC * 2.2, 0.0, 1.0));

    vec3 compositeColor = mix(skinShaded, visceraColor, isWound);

    // -------------------------------------------------------------
    // 7. Blinn-Phong Specular Gloss (Shininess 128.0)
    // Wet, glossy, fresh reflection of light source
    // -------------------------------------------------------------
    float specHighlight = pow(NdotH, 128.0); // Exactly 128.0 as requested
    float fresnel = 0.04 + 0.96 * pow(clamp(1.0 - NdotV, 0.0, 1.0), 5.0);

    vec3 wetSpecular = vec3(1.0) * (specHighlight * 1.8 + fresnel * 0.28) * isWet;

    // -------------------------------------------------------------
    // 8. Micro-Chromatic Aberration Strictly along Specular Highlights
    // -------------------------------------------------------------
    if (specHighlight > 0.06 && isWet > 0.25) {
      vec2 specDisp = (lightPos.xy - uv) * 0.003;
      float specR = pow(max(dot(normalize(normal + vec3(specDisp.x * 6.0, 0.0, 0.0)), halfDir), 0.0), 128.0);
      float specB = pow(max(dot(normalize(normal - vec3(specDisp.x * 6.0, 0.0, 0.0)), halfDir), 0.0), 128.0);
      wetSpecular.r += specR * 0.45;
      wetSpecular.b += specB * 0.45;
    }

    compositeColor += wetSpecular;

    // -------------------------------------------------------------
    // 9. Post-Processing: 0.06 Film Noise Overlay & Soft Vignette
    // -------------------------------------------------------------
    // Fine-grain film noise overlay (opacity ~0.06) to eliminate digital banding
    float filmNoise = (hash(pixelCoord + fract(u_time * 1.5)) - 0.5) * 0.06;
    compositeColor += filmNoise;

    // Subtle vignette around borders to direct focus inward
    float vignette = 1.0 - smoothstep(0.55, 1.40, length(uv - 0.5) * 1.25);
    compositeColor *= (0.87 + vignette * 0.13);

    gl_FragColor = vec4(compositeColor, 1.0);
  }
`;
