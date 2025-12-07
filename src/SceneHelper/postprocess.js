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
            precision highp sampler2D;
            precision highp sampler3D;
            
            in vec2 v_texCoord;
            out vec4 outColor;
            
            uniform sampler3D u_lutTexture;
            uniform sampler2D u_inputTexture;
            uniform vec2 u_resolution;
            
            #define uLUTSize 32.0;
            uniform float u_lutIntensity;
            uniform float u_brightness;
            uniform float u_contrast;
            uniform float u_saturation;
            uniform float u_hueShift;
            
            // RGB到HSL转换
            vec3 rgbToHsl(vec3 color) {
                vec3 hsl = color;
                
                float maxVal = max(max(color.r, color.g), color.b);
                float minVal = min(min(color.r, color.g), color.b);
                float delta = maxVal - minVal;
                
                float lightness = (maxVal + minVal) * 0.5;
                float saturation = 0.0;
                float hue = 0.0;
                
                if (delta != 0.0) {
                    saturation = lightness < 0.5 ? delta / (maxVal + minVal) : delta / (2.0 - maxVal - minVal);
                    
                    if (maxVal == color.r) {
                        hue = (color.g - color.b) / delta + (color.g < color.b ? 6.0 : 0.0);
                    } else if (maxVal == color.g) {
                        hue = (color.b - color.r) / delta + 2.0;
                    } else {
                        hue = (color.r - color.g) / delta + 4.0;
                    }
                    
                    hue /= 6.0;
                }
                
                return vec3(hue, saturation, lightness);
            }
            float hueToRgb(float p, float q, float t) {
                if (t < 0.0) t += 1.0;
                if (t > 1.0) t -= 1.0;
                
                if (t < 0.1666667) return p + (q - p) * 6.0 * t;
                if (t < 0.5) return q;
                if (t < 0.6666667) return p + (q - p) * (0.6666667 - t) * 6.0;
                return p;
            }
            // HSL到RGB转换
            vec3 hslToRgb(vec3 hsl) {
                vec3 rgb = vec3(0.0);
                
                if (hsl.y == 0.0) {
                    rgb = vec3(hsl.z);
                } else {
                    float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
                    float p = 2.0 * hsl.z - q;
                    
                    rgb.r = hueToRgb(p, q, hsl.x + 0.3333333);
                    rgb.g = hueToRgb(p, q, hsl.x);
                    rgb.b = hueToRgb(p, q, hsl.x - 0.3333333);
                }
                
                return rgb;
            }
            
            // 应用LUT
            vec3 applyLUT(vec3 color, float intensity) {
                if (intensity <= 0.0) return color;
                
                // 计算像素边界偏移
                float pixelWidth = 1.0 / uLUTSize;
                float halfPixelWidth = 0.5 / uLUTSize;
                
                // 将颜色映射到LUT纹理坐标
                vec3 lutCoord = vec3(halfPixelWidth) + color * (1.0 - pixelWidth);
                
                // 采样LUT
                vec3 lutColor = texture(u_lutTexture, lutCoord).rgb;
                
                // 混合原始颜色和LUT颜色
                return mix(color, lutColor, intensity);
            }
            
            // 调整亮度
            vec3 adjustBrightness(vec3 color, float brightness) {
                return color * brightness;
            }
            
            // 调整对比度
            vec3 adjustContrast(vec3 color, float contrast) {
                return (color - 0.5) * contrast + 0.5;
            }
            
            // 调整饱和度
            vec3 adjustSaturation(vec3 color, float saturation) {
                float luma = dot(color, vec3(0.299, 0.587, 0.114));
                return mix(vec3(luma), color, saturation);
            }
            
            // 调整色调
            vec3 adjustHue(vec3 color, float hueShift) {
                vec3 hsl = rgbToHsl(color);
                hsl.x = fract(hsl.x + hueShift);
                return hslToRgb(hsl);
            }
            
            void main() {
                // 采样原始图片
                vec4 color = texture(u_inputTexture, v_texCoord);
                
                // 应用色彩调整
                vec3 adjustedColor = color.rgb;
                
                // 应用色调调整
                adjustedColor = adjustHue(adjustedColor, u_hueShift);
                
                // 应用饱和度调整
                adjustedColor = adjustSaturation(adjustedColor, u_saturation);
                
                // 应用对比度调整
                adjustedColor = adjustContrast(adjustedColor, u_contrast);
                
                // 应用亮度调整
                adjustedColor = adjustBrightness(adjustedColor, u_brightness);
                
                // 应用LUT
                if (u_lutIntensity > 0.0) {
                    adjustedColor = applyLUT(adjustedColor, u_lutIntensity);
                }
                
                outColor = vec4(adjustedColor, color.a);
            }
        `;
        
        this.program = this.graphicsAPI.setupProgram(vsSource, fsSource);
        this.uniforms = this.graphicsAPI.getUniform(this.program);
        this.attributes = this.graphicsAPI.getAttrib(this.program);

        this.lutTexture = this.graphicsAPI.loadTexture3D("/scenes/LUT.jpg", true)
        
        // 创建全屏四边形VAO
        this.vao = this.graphicsAPI.setupFullscreenQuadVAO(
            this.attributes['a_position'],
            this.attributes['a_texCoord']
        );
        
        // 默认参数
        this.params = {
            lutIntensity: 0.0,
            brightness: 1.0,
            contrast: 1.0,
            saturation: 1.0,
            hueShift: 0.0,
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
        const inputBindSlot = 7;
        const lutBindSlot = 6;
        this.graphicsAPI.updateUniform(this.uniforms.u_inputTexture, '1i', inputBindSlot);
        this.graphicsAPI.updateUniform(this.uniforms.u_lutTexture, '1i', lutBindSlot);
        this.graphicsAPI.updateUniform(this.uniforms.u_resolution, '2f', resolution[0], resolution[1]);
        this.graphicsAPI.updateUniform(this.uniforms.u_lutIntensity, '1f', this.params.lutIntensity);
        this.graphicsAPI.updateUniform(this.uniforms.u_brightness, '1f', this.params.brightness);
        this.graphicsAPI.updateUniform(this.uniforms.u_contrast, '1f', this.params.contrast);
        this.graphicsAPI.updateUniform(this.uniforms.u_saturation, '1f', this.params.saturation);
        this.graphicsAPI.updateUniform(this.uniforms.u_hueShift, '1f', this.params.hueShift);
        
        // 激活纹理单元0
        this.graphicsAPI.bindTexture(inputTexture, inputBindSlot);
        this.graphicsAPI.bindTexture3D(this.lutTexture, lutBindSlot);
        
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