import { GraphicsApiType, GlobalVars } from "../Global.js";

export class WebGL {
    constructor(canvas) {
        this.graphicsAPI = canvas.getContext("webgl2", {
            antialias: false,
        });
        GlobalVars.graphicsAPI = GraphicsApiType.WEBGL;
    }

    updateViewport(offset = null, size = null) {
        const gl = this.graphicsAPI;
        offset = offset || { x: 0, y: 0 };
        size = size || { x: gl.canvas.width, y: gl.canvas.height };
        gl.viewport(offset.x, offset.y, size.x, size.y);
    }

    updateClearColor(r = 0, g = 0, b = 0, a = 1) {
        const gl = this.graphicsAPI;
        gl.clearColor(r, g, b, a);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    updateBuffer(buffer, data) {
        const gl = this.graphicsAPI;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    getBufferData(tf) {
        const gl = this.graphicsAPI;
        gl.bindBuffer(gl.ARRAY_BUFFER, tf.buffer);
        const capturedData = new Float32Array(tf.size / Float32Array.BYTES_PER_ELEMENT);
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, capturedData);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        return capturedData;
    }

    deleteBuffer(buffer) {
        if (buffer) {
            this.graphicsAPI.deleteBuffer(buffer);
        }
    }

    updateUniform(loc, type, value, transpose = null) {
        if (transpose !== null) {
            this.graphicsAPI['uniform' + type](loc, transpose, value);
        } else {
            this.graphicsAPI['uniform' + type](loc, value);
        }
    }

    updateProgram(program) {
        this.graphicsAPI.useProgram(program);
    }

    updateVertexInput(v) {
        this.graphicsAPI.bindVertexArray(v);
    }

    drawInstanced(primitive, offset, num, instanceCount, transformFeedback = null) {
        const gl = this.graphicsAPI;
        if (!transformFeedback){
            gl.drawArraysInstanced(gl[primitive], offset, num, instanceCount);
            return;
        }
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback.tf);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, transformFeedback.buffer);
        gl.enable(gl.RASTERIZER_DISCARD);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArraysInstanced(gl.POINTS, offset, num, instanceCount);
        gl.endTransformFeedback();
        gl.disable(gl.RASTERIZER_DISCARD);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    }

    setBlendState() {
        const gl = this.graphicsAPI;
        gl.enable(gl.BLEND);
        gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);

        gl.blendFuncSeparate(
            gl.SRC_ALPHA,              // color.srcFactor
            gl.ONE_MINUS_SRC_ALPHA,    // color.dstFactor
            gl.ONE,              // alpha.srcFactor
            gl.ONE_MINUS_SRC_ALPHA     // alpha.dstFactor
        );
    }

    setupTexture = function() {
        // a little hack, we only take common formats into account
        const glType = {
            'F': { '16': 'HALF_FLOAT', '32': 'FLOAT' },
            'UI': { '8': 'UNSIGNED_BYTE', '16': 'UNSIGNED_SHORT', '32': 'UNSIGNED_INT'},
            'I': { '8': 'BYTE', '16': 'SHORT', '32': 'INT'},
        }
        const getFormatType = function(interformat) {
            const colorPart = interformat.match(/^(RGBA|RGB|RG|R)/)?.[0];
            const isInteger = interformat.includes('UI');
            const match = interformat.match(/(\d+)([A-Za-z]+)$/);
            const [, number, suffix] = match;
            return { format: isInteger ? `${colorPart}_INTEGER` : colorPart, type: glType[suffix][number] || 'UNSIGNED_BYTE' };
        }

        const getTypedArrayConstructor = function(type) {
            switch (type) {
                case 'BYTE': return Int8Array;
                case 'UNSIGNED_BYTE': return Uint8Array;
                case 'SHORT': return Int16Array;
                case 'UNSIGNED_SHORT':
                case 'HALF_FLOAT': return Uint16Array;
                case 'INT': return Int32Array;
                case 'UNSIGNED_INT': return Uint32Array;
                case 'FLOAT': return Float32Array;
                default:
                    throw new Error(`Unsupported type: ${type}`);
            }
        }

        return function(desc) {
            const gl = this.graphicsAPI;
            const texture = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0 + desc.bind);
            gl.bindTexture(gl.TEXTURE_2D, texture);

            const {format, type} = getFormatType(desc.format);
            const TypedArray = getTypedArrayConstructor(type);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,                          // mipmap level
                gl[desc.format],            // format
                desc.width,                 // width
                desc.height,                // height
                0,                          // border
                gl[format],                 // format
                gl[type],                   // type
                new TypedArray(desc.buffer),
            );

            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

            desc.texture = texture;
        }
    }();

    deleteTexture(tex) {
        const gl = this.graphicsAPI;
        if (tex) {
            gl.deleteTexture(tex);
            tex = null;
        }
    }

    setupVAO(vertexPosLocation, instanceIndexLocation, splatCount, vertexBuffer = null) {
        const gl = this.graphicsAPI;
        const vertexPositions = new Float32Array([
            -1.0, -1.0, 0.0, 1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, 1.0, 0.0
        ]);
        let vbo = vertexBuffer;
        if (!vbo) {
            vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, vertexPositions, gl.STATIC_DRAW);
        }

        const instanceIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceIndexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, splatCount * Uint32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.enableVertexAttribArray(vertexPosLocation);
        gl.vertexAttribPointer(vertexPosLocation, 3, gl.FLOAT, false, 0, 0);
            
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceIndexBuffer);
        gl.enableVertexAttribArray(instanceIndexLocation);
        gl.vertexAttribIPointer(instanceIndexLocation, 1, gl.UNSIGNED_INT, 0, 0);
        gl.vertexAttribDivisor(instanceIndexLocation, 1);

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        return {
            'vao': vao,
            'vertexBuffer': vbo,
            'instanceIndexBuffer': instanceIndexBuffer,
        };
    }

    rebuildInstanceBuffer2VAO(vertexInput, instanceIndexLocation, splatCount) {
        const gl = this.graphicsAPI;
        gl.deleteBuffer(vertexInput.instanceIndexBuffer);

        const newInstanceIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, newInstanceIndexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, splatCount * Uint32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);

        gl.bindVertexArray(vertexInput.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, newInstanceIndexBuffer);
        gl.enableVertexAttribArray(instanceIndexLocation);
        gl.vertexAttribIPointer(instanceIndexLocation, 1, gl.UNSIGNED_INT, 0, 0);
        gl.vertexAttribDivisor(instanceIndexLocation, 1);

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        vertexInput.instanceIndexBuffer = newInstanceIndexBuffer;
    }

    deleteVAO(vao) {
        const gl = this.graphicsAPI;
        if (vao) {
            gl.deleteVertexArray(vao);
            vao = null;
        }
    }

    setupProgram(vsSrc, fsSrc, feedbackVaryings = null) {
        const gl = this.graphicsAPI;

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSrc);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fsSrc);

        if (!vertexShader || !fragmentShader) {
            return null;
        }

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);

        if (feedbackVaryings && feedbackVaryings.length > 0) {
            gl.transformFeedbackVaryings(program, feedbackVaryings, gl.INTERLEAVED_ATTRIBS);
        }

        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }

        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        return program;
    }

    setupTransformFeedback(size) {
        const gl = this.graphicsAPI;
        const tf = gl.createTransformFeedback();
        const feedbackBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, feedbackBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, size, gl.DYNAMIC_READ);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        return {
            tranformFeedback: tf,
            buffer: feedbackBuffer,
        };
    }

    compileShader(type, source) {
        const gl = this.graphicsAPI;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(`${type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment'} shader error:`, gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    getUniform(program) {
        const gl = this.graphicsAPI;
        const uniformMap = {};

        const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; i++) {
            const info = gl.getActiveUniform(program, i);
            const location = gl.getUniformLocation(program, info.name);
            uniformMap[info.name] = location;
        }
        return uniformMap;
    }

    getAttrib(program) {
        const gl = this.graphicsAPI;
        const attribMap = {};

        const numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numAttribs; i++) {
            const info = gl.getActiveAttrib(program, i);
            const location = gl.getAttribLocation(program, info.name);
            attribMap[info.name] = location;
        }
        return attribMap;
    }

    deleteProgram(program) {
        if (program) {
            this.graphicsAPI.deleteProgram(program);
            program = null;
        }
    }
}