export class PostProcess {
    constructor(graphicsAPI) {
        this.graphicsAPI = graphicsAPI;
        
        // --- 后处理着色器 ---
        const vsSource = `#version 300 es
            in vec2 a_position;
            in vec2 a_texCoord;
            out vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
        
        const fsSource = `#version 300 es
            precision highp float;
            
            in vec2 v_texCoord;
            out vec4 outColor;
            
            uniform sampler2D u_inputTexture;
            uniform vec2 u_resolution;
            uniform float u_time;
            uniform float u_exposure;
            uniform float u_bloomIntensity;
            uniform float u_vignetteIntensity;
            uniform float u_chromaticAberration;
            uniform float u_filmGrain;
            uniform float u_gamma;
            
            // 色调映射函数
            vec3 tonemapACES(vec3 x) {
                const float a = 2.51;
                const float b = 0.03;
                const float c = 2.43;
                const float d = 0.59;
                const float e = 0.14;
                return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
            }
            
            // 辉光效果
            vec3 bloom(vec3 color, vec2 uv) {
                if (u_bloomIntensity <= 0.0) return color;
                
                vec3 bloomColor = vec3(0.0);
                float blurSize = 0.002 * u_bloomIntensity;
                float totalWeight = 0.0;
                
                for (int i = -2; i <= 2; i++) {
                    for (int j = -2; j <= 2; j++) {
                        vec2 offset = vec2(float(i), float(j)) * blurSize;
                        vec3 sampleColor = texture(u_inputTexture, uv + offset).rgb;
                        float brightness = dot(sampleColor, vec3(0.2126, 0.7152, 0.0722));
                        
                        if (brightness > 0.7) {
                            float weight = 1.0 / (1.0 + length(vec2(i, j)));
                            bloomColor += sampleColor * weight;
                            totalWeight += weight;
                        }
                    }
                }
                
                if (totalWeight > 0.0) {
                    bloomColor /= totalWeight;
                }
                
                return color + bloomColor * u_bloomIntensity;
            }
            
            // 暗角效果
            vec3 vignette(vec3 color, vec2 uv) {
                if (u_vignetteIntensity <= 0.0) return color;
                
                vec2 center = vec2(0.5, 0.5);
                float dist = distance(uv, center);
                float vignette = 1.0 - dist * u_vignetteIntensity;
                vignette = smoothstep(0.0, 1.0, vignette);
                return color * vignette;
            }
            
            // 色差效果
            vec3 chromaticAberration(vec3 color, vec2 uv) {
                if (u_chromaticAberration <= 0.0) return color;
                
                float r = texture(u_inputTexture, uv + vec2(u_chromaticAberration, 0.0)).r;
                float g = texture(u_inputTexture, uv).g;
                float b = texture(u_inputTexture, uv - vec2(u_chromaticAberration, 0.0)).b;
                return vec3(r, g, b);
            }
            
            // 胶片颗粒
            vec3 filmGrain(vec3 color, vec2 uv) {
                if (u_filmGrain <= 0.0) return color;
                
                float noise = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
                noise = (noise - 0.5) * 2.0;
                noise = fract(noise + u_time * 0.1);
                noise = (noise - 0.5) * 2.0;
                
                return color + noise * u_filmGrain;
            }
            
            void main() {
                vec2 uv = v_texCoord;
                vec3 color = texture(u_inputTexture, uv).rgb;

                // 应用曝光
                color *= u_exposure;
                
                // 应用后处理效果
                color = bloom(color, uv);
                color = chromaticAberration(color, uv);
                color = vignette(color, uv);
                color = filmGrain(color, uv);
                
                // 色调映射
                // color = tonemapACES(color);
                
                // Gamma校正
                // color = pow(color, vec3(1.0 / u_gamma));
                
                outColor = vec4(color, 1.0);
            }
        `;
        
        this.program = this.graphicsAPI.setupProgram(vsSource, fsSource);
        this.uniforms = this.graphicsAPI.getUniform(this.program);
        this.attributes = this.graphicsAPI.getAttrib(this.program);
        
        // 创建全屏四边形VAO
        this.vao = this.graphicsAPI.setupFullscreenQuadVAO(
            this.attributes['a_position'],
            this.attributes['a_texCoord']
        );
        
        // 默认参数
        this.params = {
            exposure: 1.0,
            bloomIntensity: 0.0,
            vignetteIntensity: 0.0,
            chromaticAberration: 0.0,
            filmGrain: 0.0,
            gamma: 2.2
        };
    }
    
    /**
     * 设置后处理参数
     * @param {object} params - 参数对象
     */
    setParams(params) {
        this.params = { ...this.params, ...params };
    }
    
    /**
     * 渲染后处理效果
     * @param {WebGLTexture} inputTexture - 输入纹理
     * @param {number} time - 时间（秒）
     * @param {[number, number]} resolution - 分辨率 [width, height]
     */
    render(inputTexture, time, resolution) {
        this.graphicsAPI.updateProgram(this.program);
        this.graphicsAPI.updateVertexInput(this.vao.vao);
        
        // 更新uniform
        const bindSlot = 6;
        this.graphicsAPI.updateUniform(this.uniforms.u_inputTexture, '1i', bindSlot);
        this.graphicsAPI.updateUniform(this.uniforms.u_resolution, '2f', resolution[0], resolution[1]);
        this.graphicsAPI.updateUniform(this.uniforms.u_time, '1f', time);
        this.graphicsAPI.updateUniform(this.uniforms.u_exposure, '1f', this.params.exposure);
        this.graphicsAPI.updateUniform(this.uniforms.u_bloomIntensity, '1f', this.params.bloomIntensity);
        this.graphicsAPI.updateUniform(this.uniforms.u_vignetteIntensity, '1f', this.params.vignetteIntensity);
        this.graphicsAPI.updateUniform(this.uniforms.u_chromaticAberration, '1f', this.params.chromaticAberration);
        this.graphicsAPI.updateUniform(this.uniforms.u_filmGrain, '1f', this.params.filmGrain);
        this.graphicsAPI.updateUniform(this.uniforms.u_gamma, '1f', this.params.gamma);
        
        // 激活纹理单元0
        this.graphicsAPI.bindTexture(inputTexture, bindSlot);
        
        // 绘制全屏四边形
        this.graphicsAPI.draw('TRIANGLES', 0, 6);
        this.graphicsAPI.updateVertexInput(null);
    }
    
    dispose() {
        this.graphicsAPI.deleteVertexArray(this.vao.vao);
        this.graphicsAPI.deleteBuffer(this.vao.buffer);
        this.graphicsAPI.deleteProgram(this.program);
    }
}