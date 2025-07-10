import { GraphicsApiType, GlobalVars } from "../Global.js";

export class WebGL {
    constructor(canvas) {
        this.api = canvas.getContext("webgl2", {
            antialias: false,
        });
        GlobalVars.graphicsAPI = GraphicsApiType.WEBGL;
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
            const gl = this.api;

            const texture = gl.createTexture();
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
}