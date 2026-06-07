#pragma header

// Uniforms passed from Psych Engine Lua script
uniform float iTime;
uniform bool u_Enable_SSR;
uniform bool u_Enable_SSS;
uniform bool u_Enable_AO;

uniform float u_Exposure; // Default: 1.0
uniform float u_Saturation; // Default: 1.0
uniform float u_Contrast; // Default: 1.0
uniform float u_SSR_Intensity; // Default: 0.4
uniform float u_SSS_Strength; // Default: 0.3

// Simple pseudo-random noise function for 2D grain/jitter
float noise(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// 2D Luminance function
float getLuminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Color adjustments from original ReShade code
vec3 adjustSaturation(vec3 color, float sat) {
    float grey = getLuminance(color);
    return mix(vec3(grey), color, sat);
}

vec3 adjustContrast(vec3 color, float con) {
    return (color - 0.5) * con + 0.5;
}

void main() {
    vec2 uv = openfl_TextureCoordv;
    vec4 baseColor = texture2D(bitmap, uv);
    
    // Early exit if the pixel is completely transparent
    if (baseColor.a < 0.01) {
        gl_FragColor = baseColor;
        return;
    }

    vec3 color = baseColor.rgb;
    vec2 openfl_TextureSize = openfl_TextureCoordv / uv; // Fallback size math
    vec2 pixelSize = 1.0 / openfl_TextureSize;

    // 1. FAKE AMBIENT OCCLUSION & NORMALS (Edge-Detection via high contrast delta)
    float ao = 1.0;
    if (u_Enable_AO) {
        float centerLum = getLuminance(color);
        float t = getLuminance(texture2D(bitmap, uv + vec2(0.0, pixelSize.y * 2.0)).rgb);
        float b = getLuminance(texture2D(bitmap, uv - vec2(0.0, pixelSize.y * 2.0)).rgb);
        float l = getLuminance(texture2D(bitmap, uv - vec2(pixelSize.x * 2.0, 0.0)).rgb);
        float r = getLuminance(texture2D(bitmap, uv + vec2(pixelSize.x * 2.0, 0.0)).rgb);
        
        // High difference in adjacent luminosities creates micro-shadows (Fake AO)
        float edgeDiff = abs(centerLum - t) + abs(centerLum - b) + abs(centerLum - l) + abs(centerLum - r);
        ao = saturate(1.0 - (edgeDiff * 0.5));
    }

    // 2. FAKE SUBSURFACE SCATTERING (Soft bloom blur around glowing/skin elements)
    vec3 sssColor = vec3(0.0);
    if (u_Enable_SSS) {
        float totalWeight = 0.0;
        // Check surrounding pixels to blend light bleeding
        for (int i = -2; i <= 2; i++) {
            for (int j = -2; j <= 2; j++) {
                vec2 offset = vec2(float(i), float(j)) * pixelSize * 1.5;
                vec4 sampleCol = texture2D(bitmap, uv + offset);
                // Bleed light heavily into high red-channel tones (Skin/Glow simulation)
                float weight = sampleCol.a * (sampleCol.r * 0.5 + 0.5); 
                sssColor += sampleCol.rgb * weight;
                totalWeight += weight;
            }
        }
        sssColor /= max(totalWeight, 0.001);
        color = mix(color, sssColor, u_SSS_Strength * 0.3);
    }

    // 3. 2D SCREEN SPACE REFLECTIONS (Raymarching downwards looking for other sprites)
    vec3 ssrColor = vec3(0.0);
    if (u_Enable_SSR) {
        float hit = 0.0;
        vec2 rayUV = uv;
        // Raymarch downwards across the 2D plane to catch underlying imagery/floors
        for (int i = 0; i < 12; i++) {
            rayUV.y += 0.015; // March downward direction
            if (rayUV.y > 1.0) break;
            
            vec4 checkSample = texture2D(bitmap, rayUV);
            // If we hit an opaque pixel below us, reflect it
            if (checkSample.a > 0.8) {
                ssrColor = checkSample.rgb;
                hit = 1.0 - (float(i) / 12.0); // Attenuate reflection by distance
                break;
            }
        }
        // Apply reflection based on how dark/metallic the baseline pixel is
        float reflectivity = (1.0 - getLuminance(color)) * u_SSR_Intensity;
        color += ssrColor * hit * reflectivity;
    }

    // 4. FINAL POST PROCESSING (AO, Color Grading & Tone Mapping)
    color *= ao;
    color = adjustSaturation(color, u_Saturation);
    color = adjustContrast(color, u_Contrast);
    color *= u_Exposure;

    // ACES Film Tone Mapping Approximation from your original script
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    color = saturate((color * (a * color + b)) / (color * (c * color + d) + e));

    // Gamma Correction
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, baseColor.a);
}
