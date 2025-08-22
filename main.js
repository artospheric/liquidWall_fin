const canvas = document.getElementById('myCanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    console.error('WebGL error');
}

const shaderSettings = {
    u_scale: 0.4,
    u_minRandomScale: 0.3,
    u_maxRandomScale: 1.5,
    animationSpeed: 0.15,
    u_mouseEffectRadius: 0.03,
    u_mouseEffectIntensity: 0.05,
    u_noiseScale: 15.0,
    u_noiseIntensity: 0.2,
    u_decaySpeed: 0.015,
    holoStrength: 0.6,
    // New default values from the image
    u_grainScale: 1.75,      
    u_grainIntensity: 0.42,
    u_displacementStrength: 0.2,
    u_blendMode: 2.0, // 'Screen' is index 2
    u_grainContrastLarge: 1.05, // Updated
    u_grainContrastMedium: 2.29, // Updated
    u_grainContrastSmall: 2.18, // Updated
    u_grainBrightness: -0.28,
    u_patternScale: 0.88, // Updated
    // New controls for toggling grain layers
    u_largeGrainEnabled: true,
    u_mediumGrainEnabled: true,
    u_smallGrainEnabled: true
};

const fragmentShaderSource = `#define PI 3.141592654
#define TAU (2.0*PI)

precision mediump float;

uniform vec2 iResolution;
uniform float iTime;
uniform float u_scale;
uniform float u_minRandomScale;
uniform float u_maxRandomScale;
uniform float u_mouseEffectRadius;
uniform float u_mouseEffectIntensity;
uniform float u_noiseScale;
uniform float u_noiseIntensity;
uniform vec2 u_decayedMousePosition;
uniform float u_holoStrength;
uniform float u_grainScale;
uniform float u_grainIntensity;
uniform float u_displacementStrength;
uniform float u_blendMode;
uniform float u_grainContrastLarge;
uniform float u_grainContrastMedium;
uniform float u_grainContrastSmall;
uniform float u_grainBrightness;
uniform float u_patternScale;

// New uniform variables for enabling/disabling grain layers
uniform float u_largeGrainEnabled;
uniform float u_mediumGrainEnabled;
uniform float u_smallGrainEnabled;

uniform vec3 u_colors[10];

vec2 rot(vec2 p, float a) {
    float c = cos(a * 15.83);
    float s = sin(a * 15.83);
    return p * mat2(s, c, c, -s);
}

float rand(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float rand3d(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

// Улучшенная версия Perlin noise с более плавными переходами
float smootherstep(float t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float perlin_noise_3d_improved(vec3 p) {
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    
    // Используем более плавную интерполяцию
    vec3 uv = vec3(smootherstep(fp.x), smootherstep(fp.y), smootherstep(fp.z));
    
    float a = rand3d(ip);
    float b = rand3d(ip + vec3(1.0, 0.0, 0.0));
    float c = rand3d(ip + vec3(0.0, 1.0, 0.0));
    float d = rand3d(ip + vec3(1.0, 1.0, 0.0));
    float e = rand3d(ip + vec3(0.0, 0.0, 1.0));
    float f = rand3d(ip + vec3(1.0, 0.0, 1.0));
    float g = rand3d(ip + vec3(0.0, 1.0, 1.0));
    float h = rand3d(ip + vec3(1.0, 1.0, 1.0));
    
    float k0 = mix(mix(a, b, uv.x), mix(c, d, uv.x), uv.y);
    float k1 = mix(mix(e, f, uv.x), mix(g, h, uv.x), uv.y);
    
    return mix(k0, k1, uv.z);
}

// Функция для создания многооктавного шума
float fbm_3d(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 4; i++) {
        if (i >= octaves) break;
        value += amplitude * perlin_noise_3d_improved(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
        // Добавляем небольшое смещение для каждой октавы
        p += vec3(0.1, 0.1, 0.1);
    }
    
    return value;
}

float perlin_noise_3d(vec3 p) {
    return perlin_noise_3d_improved(p);
}

float perlin_noise_2d(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    vec2 uv = fp * fp * (3.0 - 2.0 * fp);
    float a = rand(ip);
    float b = rand(ip + vec2(1.0, 0.0));
    float c = rand(ip + vec2(0.0, 1.0));
    float d = rand(ip + vec2(1.0, 1.0));
    return mix(mix(a, b, uv.x), mix(c, d, uv.x), uv.y);
}

vec3 palette(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t <= 0.111) {
        return mix(u_colors[0], u_colors[1], smoothstep(0.0, 0.111, t));
    } else if (t <= 0.222) {
        return mix(u_colors[1], u_colors[2], smoothstep(0.111, 0.222, t));
    } else if (t <= 0.333) {
        return mix(u_colors[2], u_colors[3], smoothstep(0.222, 0.333, t));
    } else if (t <= 0.444) {
        return mix(u_colors[3], u_colors[4], smoothstep(0.333, 0.444, t));
    } else if (t <= 0.555) {
        return mix(u_colors[4], u_colors[5], smoothstep(0.444, 0.555, t));
    } else if (t <= 0.666) {
        return mix(u_colors[5], u_colors[6], smoothstep(0.555, 0.666, t));
    } else if (t <= 0.777) {
        return mix(u_colors[6], u_colors[7], smoothstep(0.666, 0.777, t));
    } else if (t <= 0.888) {
        return mix(u_colors[7], u_colors[8], smoothstep(0.777, 0.888, t));
    } else {
        return mix(u_colors[8], u_colors[9], smoothstep(0.888, 1.0, t));
    }
}

float myHeight(vec2 uv, float iTime, vec2 u_decayedMousePosition) {
    vec2 final_uv = vec2(.125, .75) + (uv - vec2(.125, .75)) * .03;
    float T = iTime * .65;
    vec3 c = clamp(1. - .48 * vec3(
        length(final_uv - vec2(0.0, 0.5)),
        length(final_uv - vec2(1.0, .3)),
        length(final_uv - vec2(1.0, 0.1))
    ), 0., 1.) * 2. - 1.;
    vec3 c0 = vec3(0);
    float w0 = 0.;
    const float N = 20.;
    for (float i = 0.; i < N; i++) {
        float random_pos_offset = rand(vec2(i, 1.0));
        float random_speed_multiplier = rand(vec2(i, 2.0));
        float final_random_scale = u_minRandomScale + random_pos_offset * (u_maxRandomScale - u_minRandomScale);
        vec2 swirl_uv = final_uv * final_random_scale;
        float current_time = T * (1.0 + random_speed_multiplier * 0.1);
        float wt = (i * i / N / N - .2) * 0.3;
        float wp = 0.5 + (i + 1.) * (i + 1.5) * 0.001;
        float wb = .05 + i / N * 0.1;

        vec2 centered_uv = uv - vec2(iResolution.x / iResolution.y * 0.5, 0.5) * u_scale;
        float dist_to_mouse = length(centered_uv - u_decayedMousePosition);
        float noise_val = perlin_noise_2d(centered_uv * u_noiseScale + iTime) * u_noiseIntensity;
        float effective_radius = u_mouseEffectRadius + noise_val;
        float mouse_influence = 1.0 - smoothstep(0.0, effective_radius, dist_to_mouse);
        mouse_influence = pow(mouse_influence, 2.0);

        float mouse_speed_effect = u_mouseEffectIntensity * mouse_influence;
        c.zx = rot(c.zx, 0.1 + current_time * 0.1 * wt + (swirl_uv.x + .7) * 23. * wp + mouse_speed_effect);
        c.xy = rot(c.xy, c.z * c.x * wb + 1.7 + current_time * wt + (swirl_uv.y + 1.1) * 15. * wp + mouse_speed_effect);
        c.yz = rot(c.yz, c.x * c.y * wb + 2.4 - current_time * 0.65 * wt + (swirl_uv.x + swirl_uv.y * (fract(i / 2.) - 0.25) * 4.) * 17. * wp + mouse_speed_effect);
        c.zx = rot(c.zx, c.y * c.z * wb + 1.6 - current_time * 0.65 * wt + (swirl_uv.x + .7) * 23. * wp + mouse_speed_effect);
        float w = (100.5 - i / N);
        c0 += c * w;
        w0 += w;
    }
    c0 = c0 / w0 * 2. + .5;
    c0 *= .5 + dot(c0, vec3(1, 1, 1)) / sqrt(3.) * .5;
    c0 += pow(length(sin(c0 * PI * 4.)) / sqrt(3.) * 1.0, 20.) * (.3 + .7 * c0);
    return length(c0);
}

vec3 normal(vec2 p) {
    vec2 eps = vec2(0.01, 0.0);
    float h = myHeight(p, iTime, u_decayedMousePosition);
    float hx = myHeight(p + eps.xy, iTime, u_decayedMousePosition);
    float hy = myHeight(p + eps.yx, iTime, u_decayedMousePosition);
    
    vec3 n;
    n.x = hx - h;
    n.y = hy - h;
    n.z = -eps.x * 20.0;
    
    return normalize(n);
}

vec3 holoOverlay(vec2 uv, vec3 n, vec3 v, vec3 l) {
    float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
    float spec = pow(max(dot(reflect(-l, n), v), 0.0), 12.0);
    float phase = (uv.x + uv.y) * 40.0 + iTime * 0.5 + dot(n.xy, vec2(5.0, -3.0));
    vec3 rainbow = 0.5 + 0.5 * cos(phase + vec3(0.0, 2.094, 4.188));
    return rainbow * fres * spec;
}

vec3 blend(vec3 base, vec3 blend_color, float mode) {
    if (mode == 0.0) { // Normal
        return base + blend_color;
    } else if (mode == 1.0) { // Multiply
        return base * blend_color;
    } else if (mode == 2.0) { // Screen
        return 1.0 - (1.0 - base) * (1.0 - blend_color);
    } else if (mode == 3.0) { // Overlay
        return mix(base * blend_color * 2.0, 1.0 - (1.0 - base) * (1.0 - blend_color) * 2.0, step(vec3(0.5), base));
    } else if (mode == 4.0) { // Hard Light
        return mix(base * blend_color * 2.0, 1.0 - (1.0 - base) * (1.0 - blend_color) * 2.0, step(vec3(0.5), blend_color));
    } else if (mode == 5.0) { // Soft Light
        vec3 grain_factor = blend_color * 2.0 - 1.0;
        return mix(base - (1.0 - 2.0 * grain_factor) * base * (1.0 - base), base + grain_factor * (1.0 - (2.0 * base - 1.0) * (2.0 * base - 1.0)), step(vec3(0.5), grain_factor));
    }
    return base;
}

void main() {
    vec2 uv = (gl_FragCoord.xy / iResolution.y) * u_scale;

    float displacement = myHeight(uv, iTime, u_decayedMousePosition) * u_displacementStrength;
    vec2 displacement_vector = vec2(cos(displacement * TAU), sin(displacement * TAU)) * displacement;

    float grain_time_large = iTime * 3.3;
    float grain_time_medium = iTime * 6.5;
    float grain_time_small = iTime * 8.7;
    
    vec2 displaced_coord_large = gl_FragCoord.xy + displacement_vector * 100.0;
    vec2 displaced_coord_medium = gl_FragCoord.xy + displacement_vector * 150.0;
    vec2 displaced_coord_small = gl_FragCoord.xy + displacement_vector * 200.0;
    
    // Используем улучшенную версию шума с множественными октавами
    float grain_noise_large = 0.0;
    if (u_largeGrainEnabled > 0.5) {
        grain_noise_large = fbm_3d(vec3(displaced_coord_large * u_grainScale * 0.3 * u_patternScale, grain_time_large), 3);
        float detail_noise_large = perlin_noise_3d_improved(vec3(displaced_coord_large * u_grainScale * 0.3 * u_patternScale, grain_time_large) * 4.0 + vec3(100.0)) * 0.1;
        grain_noise_large = clamp(grain_noise_large + detail_noise_large, 0.0, 1.0);
    }

    float grain_noise_medium = 0.0;
    if (u_mediumGrainEnabled > 0.5) {
        grain_noise_medium = fbm_3d(vec3(displaced_coord_medium * u_grainScale * 0.5 * u_patternScale, grain_time_medium * 1.2), 2);
        float detail_noise_medium = perlin_noise_3d_improved(vec3(displaced_coord_medium * u_grainScale * 0.5 * u_patternScale, grain_time_medium * 1.2) * 6.0 + vec3(200.0)) * 0.08;
        grain_noise_medium = clamp(grain_noise_medium + detail_noise_medium, 0.0, 1.0);
    }
    
    float grain_noise_small = 0.0;
    if (u_smallGrainEnabled > 0.5) {
        grain_noise_small = fbm_3d(vec3(displaced_coord_small * u_grainScale * 2.4 * u_patternScale, grain_time_small * 1.5), 2);
        float detail_noise_small = perlin_noise_3d_improved(vec3(displaced_coord_small * u_grainScale * 2.4 * u_patternScale, grain_time_small * 1.5) * 8.0 + vec3(300.0)) * 0.05;
        grain_noise_small = clamp(grain_noise_small + detail_noise_small, 0.0, 1.0);
    }
    
    // Apply individual contrast to each grain layer
    float contrasted_grain_noise_large = pow(grain_noise_large, u_grainContrastLarge);
    float contrasted_grain_noise_medium = pow(grain_noise_medium, u_grainContrastMedium);
    float contrasted_grain_noise_small = pow(grain_noise_small, u_grainContrastSmall);
    
    // Добавляем плавную вариацию для устранения артефактов
    float noise_seed = rand(gl_FragCoord.xy * 0.001 + sin(iTime * 0.1) * 0.1);
    float smooth_variation = sin(gl_FragCoord.x * 0.01 + iTime * 0.5) * sin(gl_FragCoord.y * 0.013 + iTime * 0.3) * 0.1;
    
    float combined_grain_noise = 
        (contrasted_grain_noise_large * (0.5 + noise_seed * 0.1)) + 
        (contrasted_grain_noise_medium * (0.5 + (1.0 - noise_seed) * 0.3)) +
        (contrasted_grain_noise_small * 0.2) +
        smooth_variation;
    
    // Apply brightness to the combined noise
    float adjusted_grain_noise = clamp(combined_grain_noise + u_grainBrightness, 0.0, 1.0);

    float height_value = myHeight(uv, iTime, u_decayedMousePosition);
    
    vec3 n = normal(uv);
    vec3 light_direction = normalize(vec3(0.5, 0.5, 1.0));
    vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));

    float diffuse = max(dot(n, light_direction), 0.0);

    vec3 base_color = palette(clamp(height_value / 2.0, 0.0, 1.0));
    vec3 final_color = base_color + (diffuse * 0.5);

    vec3 holo = holoOverlay(uv, n, viewDir, light_direction);
    final_color += u_holoStrength * holo;

    vec3 normalized_grain = vec3(adjusted_grain_noise * u_grainIntensity * (0.8 + displacement * 2.0));
    final_color = blend(final_color, normalized_grain, u_blendMode);

    gl_FragColor = vec4(final_color, 1.0);
}`;

const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;

function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = ((bigint >> 16) & 255) / 255.0;
    const g = ((bigint >> 8) & 255) / 255.0;
    const b = (bigint & 255) / 255.0;
    return [r, g, b];
}

function createSlider(min, max, step, value, onInput) {
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    slider.addEventListener('input', onInput);
    return slider;
}

function createCheckbox(labelText, checked, onInput) {
    const container = document.createElement('div');
    const label = document.createElement('label');
    label.innerText = labelText;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.addEventListener('change', onInput);
    container.appendChild(label);
    container.appendChild(checkbox);
    return container;
}

function startRendering() {
    // Add UI elements
    const uiContainer = document.createElement('div');
    uiContainer.style.position = 'absolute';
    uiContainer.style.top = '10px';
    uiContainer.style.left = '10px';
    uiContainer.style.color = '#fff';
    uiContainer.style.fontFamily = 'sans-serif';
    uiContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    uiContainer.style.padding = '10px';
    uiContainer.style.borderRadius = '5px';
    uiContainer.style.display = 'grid';
    uiContainer.style.gridTemplateColumns = 'auto 1fr auto';
    uiContainer.style.gap = '5px 10px';
    uiContainer.style.alignItems = 'center';

    // Blend mode select
    const blendModeLabel = document.createElement('label');
    blendModeLabel.innerText = 'Blend Mode: ';
    blendModeLabel.htmlFor = 'blendModeSelect';
    const blendModeSelect = document.createElement('select');
    blendModeSelect.id = 'blendModeSelect';
    
    const modes = [{ name: 'Normal', value: 0.0 }, { name: 'Screen', value: 2.0 }];
    modes.forEach(mode => {
        const option = document.createElement('option');
        option.value = mode.value;
        option.innerText = mode.name;
        blendModeSelect.appendChild(option);
    });
    blendModeSelect.value = shaderSettings.u_blendMode;
    blendModeSelect.addEventListener('change', (e) => {
        shaderSettings.u_blendMode = parseFloat(e.target.value);
    });
    uiContainer.appendChild(blendModeLabel);
    uiContainer.appendChild(blendModeSelect);
    uiContainer.appendChild(document.createElement('div')); // Placeholder for grid alignment

    // Grain Scale Slider
    const grainScaleLabel = document.createElement('label');
    grainScaleLabel.innerText = 'Grain Scale: ';
    const grainScaleSlider = createSlider('0.1', '5.0', '0.01', shaderSettings.u_grainScale, (e) => {
        shaderSettings.u_grainScale = parseFloat(e.target.value);
        grainScaleValue.innerText = e.target.value;
    });
    const grainScaleValue = document.createElement('span');
    grainScaleValue.innerText = shaderSettings.u_grainScale;
    uiContainer.appendChild(grainScaleLabel);
    uiContainer.appendChild(grainScaleSlider);
    uiContainer.appendChild(grainScaleValue);

    // Grain Intensity Slider
    const grainIntensityLabel = document.createElement('label');
    grainIntensityLabel.innerText = 'Grain Intensity: ';
    const grainIntensitySlider = createSlider('0.0', '1.0', '0.01', shaderSettings.u_grainIntensity, (e) => {
        shaderSettings.u_grainIntensity = parseFloat(e.target.value);
        grainIntensityValue.innerText = e.target.value;
    });
    const grainIntensityValue = document.createElement('span');
    grainIntensityValue.innerText = shaderSettings.u_grainIntensity;
    uiContainer.appendChild(grainIntensityLabel);
    uiContainer.appendChild(grainIntensitySlider);
    uiContainer.appendChild(grainIntensityValue);

    // Grain Contrast Sliders
    const largeContrastLabel = document.createElement('label');
    largeContrastLabel.innerText = 'Large Grain Contrast: ';
    const largeContrastSlider = createSlider('0.1', '3.0', '0.01', shaderSettings.u_grainContrastLarge, (e) => {
        shaderSettings.u_grainContrastLarge = parseFloat(e.target.value);
        largeContrastValue.innerText = e.target.value;
    });
    const largeContrastValue = document.createElement('span');
    largeContrastValue.innerText = shaderSettings.u_grainContrastLarge;
    uiContainer.appendChild(largeContrastLabel);
    uiContainer.appendChild(largeContrastSlider);
    uiContainer.appendChild(largeContrastValue);

    const mediumContrastLabel = document.createElement('label');
    mediumContrastLabel.innerText = 'Medium Grain Contrast: ';
    const mediumContrastSlider = createSlider('0.1', '3.0', '0.01', shaderSettings.u_grainContrastMedium, (e) => {
        shaderSettings.u_grainContrastMedium = parseFloat(e.target.value);
        mediumContrastValue.innerText = e.target.value;
    });
    const mediumContrastValue = document.createElement('span');
    mediumContrastValue.innerText = shaderSettings.u_grainContrastMedium;
    uiContainer.appendChild(mediumContrastLabel);
    uiContainer.appendChild(mediumContrastSlider);
    uiContainer.appendChild(mediumContrastValue);

    const smallContrastLabel = document.createElement('label');
    smallContrastLabel.innerText = 'Small Grain Contrast: ';
    const smallContrastSlider = createSlider('0.1', '3.0', '0.01', shaderSettings.u_grainContrastSmall, (e) => {
        shaderSettings.u_grainContrastSmall = parseFloat(e.target.value);
        smallContrastValue.innerText = e.target.value;
    });
    const smallContrastValue = document.createElement('span');
    smallContrastValue.innerText = shaderSettings.u_grainContrastSmall;
    uiContainer.appendChild(smallContrastLabel);
    uiContainer.appendChild(smallContrastSlider);
    uiContainer.appendChild(smallContrastValue);

    // Grain Brightness Slider
    const brightnessLabel = document.createElement('label');
    brightnessLabel.innerText = 'Grain Brightness: ';
    const brightnessSlider = createSlider('-1.0', '1.0', '0.01', shaderSettings.u_grainBrightness, (e) => {
        shaderSettings.u_grainBrightness = parseFloat(e.target.value);
        brightnessValue.innerText = e.target.value;
    });
    const brightnessValue = document.createElement('span');
    brightnessValue.innerText = shaderSettings.u_grainBrightness;
    uiContainer.appendChild(brightnessLabel);
    uiContainer.appendChild(brightnessSlider);
    uiContainer.appendChild(brightnessValue);
    
    document.body.appendChild(uiContainer);

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(program);

    const resolutionUniformLocation = gl.getUniformLocation(program, "iResolution");
    const timeUniformLocation = gl.getUniformLocation(program, "iTime");
    const scaleUniformLocation = gl.getUniformLocation(program, "u_scale");
    const minRandomScaleLocation = gl.getUniformLocation(program, "u_minRandomScale");
    const maxRandomScaleLocation = gl.getUniformLocation(program, "u_maxRandomScale");
    const mouseEffectRadiusLocation = gl.getUniformLocation(program, "u_mouseEffectRadius");
    const mouseEffectIntensityLocation = gl.getUniformLocation(program, "u_mouseEffectIntensity");
    const noiseScaleLocation = gl.getUniformLocation(program, "u_noiseScale");
    const noiseIntensityLocation = gl.getUniformLocation(program, "u_noiseIntensity");
    const decayedMousePositionLocation = gl.getUniformLocation(program, "u_decayedMousePosition");
    const holoStrengthLocation = gl.getUniformLocation(program, "u_holoStrength");
    const grainScaleLocation = gl.getUniformLocation(program, "u_grainScale");
    const grainIntensityLocation = gl.getUniformLocation(program, "u_grainIntensity");
    const displacementStrengthLocation = gl.getUniformLocation(program, "u_displacementStrength");
    const blendModeLocation = gl.getUniformLocation(program, "u_blendMode");
    const grainContrastLargeLocation = gl.getUniformLocation(program, "u_grainContrastLarge");
    const grainContrastMediumLocation = gl.getUniformLocation(program, "u_grainContrastMedium");
    const grainContrastSmallLocation = gl.getUniformLocation(program, "u_grainContrastSmall");
    const grainBrightnessLocation = gl.getUniformLocation(program, "u_grainBrightness");
    const patternScaleLocation = gl.getUniformLocation(program, "u_patternScale");
    // New uniform locations
    const largeGrainEnabledLocation = gl.getUniformLocation(program, "u_largeGrainEnabled");
    const mediumGrainEnabledLocation = gl.getUniformLocation(program, "u_mediumGrainEnabled");
    const smallGrainEnabledLocation = gl.getUniformLocation(program, "u_smallGrainEnabled");

    const colorsUniformLocation = gl.getUniformLocation(program, "u_colors[0]");

    const defaultColors = [
        '#ffffff', '#ffffff', '#999cb2', '#303336', '#68667a',
        '#2f3241', '#535a6e', '#97acbf', '#7d84a1', '#ffffff'
    ];
    
    const cachedColorsData = new Float32Array([].concat(
        hexToRgb(defaultColors[0]),
        hexToRgb(defaultColors[1]),
        hexToRgb(defaultColors[2]),
        hexToRgb(defaultColors[3]),
        hexToRgb(defaultColors[4]),
        hexToRgb(defaultColors[5]),
        hexToRgb(defaultColors[6]),
        hexToRgb(defaultColors[7]),
        hexToRgb(defaultColors[8]),
        hexToRgb(defaultColors[9])
    ));

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    let mouse = [0, 0, 0, 0];
    const startTime = performance.now();
    let decayedMousePosition = [0.0, 0.0];

    canvas.addEventListener('mousemove', (e) => {
        mouse[0] = e.clientX;
        mouse[1] = canvas.height - e.clientY;
    });

    gl.uniform3fv(colorsUniformLocation, cachedColorsData);

    function render(currentTime) {
        const time = (currentTime - startTime) * 0.001 * shaderSettings.animationSpeed;

        const centered_mouse_uv = [
            (mouse[0] / gl.canvas.width - 0.5) * (gl.canvas.width / gl.canvas.height) * shaderSettings.u_scale,
            (mouse[1] / gl.canvas.height - 0.5) * shaderSettings.u_scale
        ];
        
        decayedMousePosition[0] += (centered_mouse_uv[0] - decayedMousePosition[0]) * shaderSettings.u_decaySpeed;
        decayedMousePosition[1] += (centered_mouse_uv[1] - decayedMousePosition[1]) * shaderSettings.u_decaySpeed;

        gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
        gl.uniform1f(timeUniformLocation, time);
        gl.uniform1f(scaleUniformLocation, shaderSettings.u_scale);
        gl.uniform1f(minRandomScaleLocation, shaderSettings.u_minRandomScale);
        gl.uniform1f(maxRandomScaleLocation, shaderSettings.u_maxRandomScale);
        gl.uniform1f(mouseEffectRadiusLocation, shaderSettings.u_mouseEffectRadius);
        gl.uniform1f(mouseEffectIntensityLocation, shaderSettings.u_mouseEffectIntensity);
        gl.uniform1f(noiseScaleLocation, shaderSettings.u_noiseScale);
        gl.uniform1f(noiseIntensityLocation, shaderSettings.u_noiseIntensity);
        gl.uniform2fv(decayedMousePositionLocation, decayedMousePosition);
        gl.uniform1f(holoStrengthLocation, shaderSettings.holoStrength);
        gl.uniform1f(grainScaleLocation, shaderSettings.u_grainScale);
        gl.uniform1f(grainIntensityLocation, shaderSettings.u_grainIntensity);
        gl.uniform1f(displacementStrengthLocation, shaderSettings.u_displacementStrength);
        gl.uniform1f(blendModeLocation, shaderSettings.u_blendMode);
        gl.uniform1f(grainContrastLargeLocation, shaderSettings.u_grainContrastLarge);
        gl.uniform1f(grainContrastMediumLocation, shaderSettings.u_grainContrastMedium);
        gl.uniform1f(grainContrastSmallLocation, shaderSettings.u_grainContrastSmall);
        gl.uniform1f(grainBrightnessLocation, shaderSettings.u_grainBrightness);
        gl.uniform1f(patternScaleLocation, shaderSettings.u_patternScale);
        // Set new uniform values
        gl.uniform1f(largeGrainEnabledLocation, shaderSettings.u_largeGrainEnabled ? 1.0 : 0.0);
        gl.uniform1f(mediumGrainEnabledLocation, shaderSettings.u_mediumGrainEnabled ? 1.0 : 0.0);
        gl.uniform1f(smallGrainEnabledLocation, shaderSettings.u_smallGrainEnabled ? 1.0 : 0.0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(render);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    requestAnimationFrame(render);
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader, gl.COMPILE_STATUS);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

function resizeCanvas() {
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;
    if (gl.canvas.width !== displayWidth || gl.canvas.height !== displayHeight) {
        gl.canvas.width = displayWidth;
        gl.canvas.height = displayHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }
}

startRendering();