/**
 * Museum-Grade Dynamic Heightfield & Dual-Material Visceral Master Shader
 * 
 * Implements:
 * 1. Dynamic Surface Normal Mapping from Heightfield
 * 2. Movable Directional Light with Ambient Fill
 * 3. Dual-Material Response:
 *    - Dry Skin / Vellum: Roughness 0.95, Muted Alabaster (#E8DFD8), Red SSS Bleed
 *    - Wet Viscera & Blood: Roughness 0.05, Sharp Blinn-Phong Specular (n=420), Fresnel Sheen
 * 4. Contact Ambient Occlusion deep in crevices
 * 5. Visceral Blood Palette: Arterial Crimson (#7A0C16) to Clotted Burgundy (#220508)
 * 6. Fibrous Collagen Connective Strands
 * 7. Post-processing: 0.06 Film Grain, Soft Vignette, Micro-Chromatic Aberration on Specular Highlights
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

  // Film grain hash
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Micro surface noise for skin pores
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Decode height from texture R channel [0, 1] -> [-1.0, 1.0]
  float decodeHeight(float byteVal) {
    return byteVal * 2.0 - 1.0;
  }

  void main() {
    vec2 uv = vUv;
    vec2 pixelCoord = uv * u_resolution;
    vec2 texel = 1.0 / u_resolution;

    // Sample heightfield center and 4-point neighborhood
    vec4 sampC = texture2D(u_heightTexture, uv);
    vec4 sampL = texture2D(u_heightTexture, uv - vec2(texel.x * 1.5, 0.0));
    vec4 sampR = texture2D(u_heightTexture, uv + vec2(texel.x * 1.5, 0.0));
    vec4 sampD = texture2D(u_heightTexture, uv - vec2(0.0, texel.y * 1.5));
    vec4 sampU = texture2D(u_heightTexture, uv + vec2(0.0, texel.y * 1.5));

    // Decode heights
    float hC = decodeHeight(sampC.r);
    float hL = decodeHeight(sampL.r);
    float hR = decodeHeight(sampR.r);
    float hD = decodeHeight(sampD.r);
    float hU = decodeHeight(sampU.r);

    // Fluid volume (Channel G)
    float fluidC = sampC.g;
    float fluidL = sampL.g;
    float fluidR = sampR.g;
    float fluidD = sampD.g;
    float fluidU = sampU.g;

    // Capillary stain (Channel B)
    float stainC = sampC.b;

    // Connective strands (Channel A)
    float strandC = sampC.a;

    // Total effective surface elevation (including fluid pool and micro-skin texture)
    float microPores = noise(pixelCoord * 0.45) * 0.018;
    float zC = hC + fluidC * 0.18 + microPores;
    float zL = hL + fluidL * 0.18;
    float zR = hR + fluidR * 0.18;
    float zD = hD + fluidD * 0.18;
    float zU = hU + fluidU * 0.18;

    // -------------------------------------------------------------
    // 1. Dynamic Surface Normal Mapping
    // -------------------------------------------------------------
    float normalScale = 7.5;
    vec3 normal = normalize(vec3(
      (zL - zR) * normalScale,
      (zD - zU) * normalScale,
      1.0
    ));

    // -------------------------------------------------------------
    // 2. Movable Directional Light Source with Ambient Fill
    // -------------------------------------------------------------
    vec3 lightPos = vec3(u_lightPos.xy, 0.65);
    vec3 fragPos = vec3(uv, zC * 0.1);
    vec3 lightDir = normalize(lightPos - fragPos);
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);

    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotH = max(dot(normal, halfDir), 0.0);
    float NdotV = max(dot(normal, viewDir), 0.0);

    // Subtle gallery ambient term
    vec3 ambientColor = vec3(0.14, 0.13, 0.12);

    // -------------------------------------------------------------
    // 3. Contact Ambient Occlusion deep inside cut crevice
    // -------------------------------------------------------------
    float trenchDepth = clamp(-hC, 0.0, 1.0);
    // Dark multiply deep inside crevice before rendering internal fluid
    float contactAO = clamp(1.0 - pow(trenchDepth, 1.35) * 0.94, 0.06, 1.0);

    // -------------------------------------------------------------
    // 4. Material 1: Dry Skin Surface (Matte Alabaster #E8DFD8)
    // -------------------------------------------------------------
    vec3 drySkinColor = vec3(0.910, 0.874, 0.847); // #E8DFD8

    // Curled lip blanching: skin under tension blenches pale before severing
    float curledLip = clamp(hC * 3.5, 0.0, 1.0);
    drySkinColor = mix(drySkinColor, vec3(0.965, 0.955, 0.940), curledLip * 0.75);

    // Subsurface scattering (SSS): warm reddish bleed around backlit grazing angles
    float sssTerm = pow(clamp(dot(viewDir, -(lightDir - normal * 0.4)), 0.0, 1.0), 3.5);
    vec3 sssGlow = vec3(0.82, 0.14, 0.09) * sssTerm * 0.45;

    // Dry surface diffuse reflection (Roughness ~0.95, powdery soft wrap)
    float skinDiffuse = pow(NdotL * 0.65 + 0.35, 1.2);
    vec3 drySurfaceShaded = drySkinColor * (skinDiffuse + ambientColor) + sssGlow;

    // -------------------------------------------------------------
    // 5. Capillary Wicking (Porosity absorption along perimeter)
    // -------------------------------------------------------------
    if (stainC > 0.01) {
      vec3 arterialCrimson = vec3(0.478, 0.047, 0.086); // #7A0C16
      vec3 wickedTone = mix(drySurfaceShaded, arterialCrimson * 0.85, 0.92);
      drySurfaceShaded = mix(drySurfaceShaded, wickedTone, stainC * 0.85);
    }

    // -------------------------------------------------------------
    // 6. Material 2: Wet Viscera & Liquid Blood (Roughness ~0.05)
    // Palette: Arterial Crimson (#7A0C16) -> Clotted Burgundy (#220508)
    // -------------------------------------------------------------
    vec3 arterialCrimson = vec3(0.478, 0.047, 0.086); // #7A0C16
    vec3 clottedBurgundy = vec3(0.133, 0.020, 0.031); // #220508

    // Depth-based blood color modulation via Beer-Lambert absorption
    float totalFluidDepth = fluidC + trenchDepth * 0.75;
    vec3 bloodColor = mix(arterialCrimson, clottedBurgundy, smoothstep(0.15, 0.75, totalFluidDepth));

    // Exposed structural dermis walls inside the trench
    vec3 dermisColor = mix(vec3(0.58, 0.08, 0.12), clottedBurgundy, trenchDepth * 0.8);

    // Composite wound interior with contact ambient occlusion
    vec3 visceraBase = mix(dermisColor, bloodColor, clamp(fluidC * 1.5, 0.0, 1.0));
    visceraBase *= contactAO;

    // -------------------------------------------------------------
    // 7. Fibrous Connective Tissue Strands (Collagen bridging the gap)
    // -------------------------------------------------------------
    if (strandC > 0.02) {
      vec3 collagenColor = vec3(0.92, 0.84, 0.85); // Pale pearlescent collagen
      // Strands catch diffuse light
      collagenColor *= (NdotL * 0.8 + 0.2);
      visceraBase = mix(visceraBase, collagenColor, strandC * 0.88);
    }

    // Blend between Dry Skin Surface and Wound Interior based on trench depth & fluid presence
    float isWound = smoothstep(0.02, 0.18, trenchDepth);
    float isWet = max(isWound * 0.85, clamp(fluidC * 2.0, 0.0, 1.0));

    vec3 compositeColor = mix(drySurfaceShaded, visceraBase, isWound);

    // -------------------------------------------------------------
    // 8. High Blinn-Phong Specular Gloss with Tight White Highlights
    // -------------------------------------------------------------
    float specGloss = pow(NdotH, 420.0); // Roughness ~0.05 (tight, sharp highlight)
    float fresnel = 0.05 + 0.95 * pow(1.0 - NdotV, 5.0); // Schlick Fresnel for wet biological fluids

    vec3 wetSpecular = vec3(1.0) * (specGloss * 1.8 + fresnel * 0.35) * isWet;

    // -------------------------------------------------------------
    // 9. Micro-Chromatic Aberration Strictly along Specular Highlights
    // -------------------------------------------------------------
    if (specGloss > 0.05 && isWet > 0.2) {
      vec2 specDisp = (lightPos.xy - uv) * 0.0035;
      float specR = pow(max(dot(normalize(vec3((zL - zR) * normalScale + specDisp.x * 12.0, (zD - zU) * normalScale, 1.0)), halfDir), 0.0), 380.0);
      float specB = pow(max(dot(normalize(vec3((zL - zR) * normalScale - specDisp.x * 12.0, (zD - zU) * normalScale, 1.0)), halfDir), 0.0), 380.0);
      wetSpecular.r += specR * 0.75;
      wetSpecular.b += specB * 0.75;
    }

    compositeColor += wetSpecular;

    // -------------------------------------------------------------
    // 10. Post-Processing: Film Grain (0.06 opacity) & Soft Vignette
    // -------------------------------------------------------------
    // Fine-grain film noise overlay (opacity ~0.06) to eliminate digital banding
    float filmGrain = (hash(pixelCoord + fract(u_time * 1.6)) - 0.5) * 0.06;
    compositeColor += filmGrain;

    // Subtle vignette around borders to direct focus inward
    float vignette = 1.0 - smoothstep(0.55, 1.42, length(uv - 0.5) * 1.25);
    compositeColor *= (0.87 + vignette * 0.13);

    gl_FragColor = vec4(compositeColor, 1.0);
  }
`;
