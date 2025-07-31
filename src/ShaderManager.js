import { GSType } from "./Global.js";
import { GSKernel_3DGS } from "./GSLoader/GSKernal/3dgs.js";
import { GSKernel_SPACETIME } from "./GSLoader/GSKernal/spacetime.js";

export class ShaderManager {
    static shaderHelperFunc = `
        ivec2 index2uv(in uint index, in uint stride, in uint offset, in ivec2 size) {
            int linearIndex = int(index * stride + offset);
            return ivec2(linearIndex % size.x, linearIndex / size.x);
        }

        vec2 uint2fp16x2(in uint packedData) {
            return unpackHalf2x16(packedData);
        }

        const float inv255 = 1.0 / 255.0;
        vec4 uint2rgba(in uint packedData) {
            float a = float((packedData >> 24) & 0xFFu) * inv255;
            float b = float((packedData >> 16) & 0xFFu) * inv255;
            float g = float((packedData >> 8)  & 0xFFu) * inv255;
            float r = float( packedData        & 0xFFu) * inv255;
            return vec4(r, g, b, a);
        }

        vec3 sRGBToLinear(vec3 srgb)
        {
          return mix(srgb / 12.92, pow((srgb + 0.055) / 1.055, vec3(2.2)), step(0.04045, srgb));
        }

        const float sqrt8 = sqrt(8.0);
        const float SH_C1 = 0.4886025119029199f;
        const float[5] SH_C2 = float[](1.0925484, -1.0925484, 0.3153916, -1.0925484, 0.5462742);
    `

    constructor(options, eventBus, graphicsAPI) {
        this.debug = options.debug;
        this.debugTF = {
            outName: 'debugOutput',
            tf: null,
            buffer: null,
            size: 0,
        };

        this.eventBus = eventBus;
        this.eventBus.on('buffersReady', this.onBuffersReady.bind(this));
        this.eventBus.on('sortDone', this.onSortDone.bind(this));
        this.graphicsAPI = graphicsAPI;
        this.programs = {};
        this.uniforms = {};
        this.attributes = {};
        this.vars = {
            'projectionMatrix': {
                'value': new Float32Array(16),
                'type': 'Matrix4fv',
                'transpose': false,
                'update': true,
            },
            'viewMatrix': {
                'value': new Float32Array(16),
                'type': 'Matrix4fv',
                'transpose': false,
                'update': true,
            },
            'cameraPosition': {
                'value': [0, 0, 0],
                'type': '3fv',
                'update': true,
            },
            'inverseFocalAdjustment': {
                'value': 1.0,
                'type': '1f',
                'update': true,
            },
            'focal': {
                'value': [0, 0],
                'type': '2fv',
                'update': true,
            },
            'invViewport': {
                'value': [0, 0],
                'type': '2fv',
                'update': true,
            },
            'orthoZoom': {
                'value': 1.0,
                'type': '1f',
                'update': true,
            },
            'orthographicMode': {
                'value': 0,
                'type': '1i',
                'update': true,
            },
            'splatCount': {
                'value': 0,
                'type': '1i',
                'update': true,
            },
            'splatScale': {
                'value': 1.0,
                'type': '1f',
                'update': true,
            },
            'sceneScale': {
                'value': 1.0,
                'type': '1f',
                'update': true,
            },
            'frustumDilation': {
                'value': 0.1,
                'type': '1f',
                'update': true,
            },
            'alphaCullThreshold': {
                'value': 3 / 255,
                'type': '1f',
                'update': true,
            }
        };
        this.vertexInput = {}
        this.key = '';
    }

    updateUniform(name, value) {
        if (this.vars[name]) {
            this.vars[name].value = value;
            this.vars[name].update = true;
        } else {
            console.warn('ShaderManager: No such vars: ', name);
        }
    }

    updateUniformTextures(buffers) {
        Object.values(buffers).forEach(value => {
            this.graphicsAPI.updateUniform(this.uniforms[this.key][value.name], '1i', value.bind);
        });
    }

    updateUniforms(force = false) {
        for (const [key, value] of Object.entries(this.vars)) {
            if (force || value.update) {
                this.graphicsAPI.updateUniform(this.uniforms[this.key][key], value.type, value.value, value.transpose);
            }
        }
    }

    debugLog() {
        const capturedData = this.graphicsAPI.getBufferData(this.debugTF);

        console.log("--- Captured Vertex Positions (from GPU) ---");
        for (let i = 0;i<1;++i) {
            const base = i * 16;
            console.log(`debugOutput 0: ${capturedData[base+0].toFixed(3)}, ${capturedData[base+1].toFixed(3)}, ${capturedData[base+2].toFixed(3)}, ${capturedData[base+3].toFixed(3)}`);
        }

    }

    onSortDone(indexArray) {
        this.graphicsAPI.updateBuffer(this.vertexInput.instanceIndexBuffer, indexArray);
    }

    async onBuffersReady({ data, sceneName }) {
        let gsKernel;
        switch (GSType[data.gsType]) {
            case GSType.ThreeD:
                gsKernel = GSKernel_3DGS;
                break;
            case GSType.SPACETIME:
                gsKernel = GSKernel_SPACETIME;
                break;
            default:
                break;
        }
        const vs = this.createVS(data.buffers, gsKernel);
        const fs = this.createFS();
        //console.log(vs);
        //console.log(fs);
        const key = data.gsType;
        this.createProgram(key, vs, fs, this.debug ? [this.debugTF.outName] : null);
        this.vertexInput = this.graphicsAPI.setupVAO(this.getAttribLoc(key, 'inPosition'), this.getAttribLoc(key, 'splatIndex'), data.num);
        this.key = key;
        if (this.debug) {
            const size = data.num * 4 * 4 * 4;
            const { tf, buffer } = this.graphicsAPI.setupTransformFeedback(size);
            this.debugTF.tf = tf;
            this.debugTF.buffer = buffer;
            this.debugTF.size = size;
        }
    }

    createVS(buffers, gsKernel) {
        let vs = `#version 300 es 
            precision highp float;
        `

        vs += `
            in uint splatIndex;
            in vec3 inPosition;
        `

        Object.values(buffers).forEach(value => {
            vs += `uniform highp ${value.format.includes('UI') ? 'u' : ''}sampler2D ${value.name};\n`
        });
        vs += `
            uniform mat4 projectionMatrix;
            uniform mat4 viewMatrix;
            uniform vec3 cameraPosition;
            uniform float inverseFocalAdjustment;
            uniform vec2 focal;
            uniform vec2 invViewport;
            uniform float orthoZoom;
            uniform int orthographicMode;

            uniform int splatCount;
            uniform float splatScale;
            uniform float sceneScale;
            uniform float frustumDilation;
            uniform float alphaCullThreshold;
        `;
        vs += gsKernel.getUniformDefines();

        vs += `
            out vec4 v_fragCol;
            out vec2 v_fragPos;
            ${this.debug ? `out vec4 debugOutput;` : ``}
        `;

        vs += ShaderManager.shaderHelperFunc;

        vs += gsKernel.getFetchFunc(buffers);

        vs += `
            void main()
            {
                vec3 splatCenter;
                vec4 splatColor;
                mat3 Vrk;
                ${gsKernel.getFetchParams()}

                splatCenter *= sceneScale;
                vec4 viewCenter = viewMatrix * vec4(splatCenter, 1.0);
                vec4 clipCenter = projectionMatrix * viewCenter;
                vec2 fragPos = inPosition.xy;
                v_fragPos = fragPos * sqrt8;

                ${gsKernel.getSpecificCode(buffers)}

                // culling
                float clip = (1.0 + frustumDilation) * clipCenter.w;
                if(abs(clipCenter.x) > clip || abs(clipCenter.y) > clip
                    || clipCenter.z < -clipCenter.w || clipCenter.z > clipCenter.w
                    || splatColor.a < alphaCullThreshold)
                {
                    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
                    return;
                }

                v_fragCol = splatColor;

                float s = 1.0 / (viewCenter.z * viewCenter.z);
                mat3 J = sceneScale * mat3(focal.x / viewCenter.z, 0., -(focal.x * viewCenter.x) * s, 0.,
                    focal.y / viewCenter.z, -(focal.y * viewCenter.y) * s, 0., 0., 0.);
                mat3 W = transpose(mat3(viewMatrix));
                mat3 T = W * J;

                mat3 cov2Dm = transpose(T) * Vrk * T;
                cov2Dm[0][0] += 0.3;
                cov2Dm[1][1] += 0.3;
                vec3 cov2Dv = vec3(cov2Dm[0][0], cov2Dm[0][1], cov2Dm[1][1]);
                vec3 ndcCenter = clipCenter.xyz / clipCenter.w;

                float a           = cov2Dv.x;
                float d           = cov2Dv.z;
                float b           = cov2Dv.y;
                float D           = a * d - b * b;
                float trace       = a + d;
                float traceOver2  = 0.5 * trace;
                float term2       = sqrt(max(0.1f, traceOver2 * traceOver2 - D));
                float       eigenValue1 = traceOver2 + term2;
                float       eigenValue2 = traceOver2 - term2;

                if(eigenValue2 <= 0.0)
                {
                    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
                    return;
                }

                // eigenValue1 = eigenValue2 = 0.2; // point cloud

                vec2 eigenVector1 = normalize(vec2(b, eigenValue1 - a));
                vec2 eigenVector2 = vec2(eigenVector1.y, -eigenVector1.x);
                vec2 basisVector1 = eigenVector1 * splatScale * min(sqrt8 * sqrt(eigenValue1), 2048.0);
                vec2 basisVector2 = eigenVector2 * splatScale * min(sqrt8 * sqrt(eigenValue2), 2048.0);

                vec2 ndcOffset = vec2(fragPos.x * basisVector1 + fragPos.y * basisVector2) * invViewport * 2.0 * inverseFocalAdjustment;
                vec4 quadPos = vec4(ndcCenter.xy + ndcOffset, ndcCenter.z, 1.0);
                gl_Position        = quadPos;

                ${this.debug ? `
                debugOutput = vec4(splatCenter, splatIndex);
                ` : ``};
            }
        `;

        return vs;
    }

    createFS() {
        return `#version 300 es
            precision highp float;
            in vec4 v_fragCol;
            in vec2 v_fragPos;

            out vec4 out_FragColor;
        
            void main () {
                float A = dot(v_fragPos, v_fragPos);
                if (A > 8.0) discard;
                float opacity = exp(-0.5 * A) * v_fragCol.a;
                out_FragColor = vec4(v_fragCol.rgb, opacity);
            }
        `
    }

    createProgram(key, vsSrc, fsSrc, capture = null) {
        const program = this.graphicsAPI.setupProgram(vsSrc, fsSrc, capture);

        if (!program) {
            console.error(`Fail to create program for ${key}`);
        }
        this.programs[key] = program;
        this.cacheLocations(key, program);
    }

    setPipelineAndBind(key = null) {
        key = key || this.key;
        const program = this.programs[key];
        if (!program) {
            console.warn(`Program "${key}" not found.`);
            return;
        }
        this.graphicsAPI.updateProgram(program);
        this.graphicsAPI.updateVertexInput(this.vertexInput.vao);
    }

    getUniformLoc(key, name) {
        const locMap = this.uniforms[key];
        if (!locMap) return null;
        return locMap[name] || null;
    }

    getAttribLoc(key, name) {
        const locMap = this.attributes[key];
        if (!locMap) return -1;
        return locMap[name] !== undefined ? locMap[name] : -1;
    }

    getUniformMap(key) {
        const locMap = this.uniforms[key];
        if (!locMap) return null;
        return locMap || null;
    }

    getAttribMap(key) {
        const locMap = this.attributes[key];
        if (!locMap) return -1;
        return locMap !== undefined ? locMap : -1;
    }

    deleteProgram(key) {
        const program = this.programs[key];
        this.graphicsAPI.deleteProgram(program);
        this.programs[key] = null;
        this.uniforms[key] = null;
        this.attributes[key] = null;
    }

    deleteAllProgram() {
        const keys = Object.keys(this.programs);

        for (const key of keys) {
            this.deleteProgram(key);
        }
    }

    cacheLocations(key) {
        const program = this.programs[key];
        this.uniforms[key] = this.graphicsAPI.getUniform(program);
        this.attributes[key] = this.graphicsAPI.getAttrib(program);
    }
}