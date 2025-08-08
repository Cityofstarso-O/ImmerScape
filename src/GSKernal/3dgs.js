import { Utils } from "../Utils.js";

export class GSKernel_3DGS {
    static offsets = [];
    static params = {
        x: 0, y: 1, z: 2,
        sx: 3, sy: 4, sz: 5,
        rx: 6, ry: 7, rz: 8, rw: 9,
        cr: 10, cg: 11, cb: 12, ca: 13,
        d1r0: 14, d1r1: 15, d1r2: 16,
        d1g0: 17, d1g1: 18, d1g2: 19,
        d1b0: 20, d1b1: 21, d1b2: 22,
        d2r0: 23, d2r1: 24, d2r2: 25, d2r3: 26, d2r4: 27,
        d2g0: 28, d2g1: 29, d2g2: 30, d2g3: 31, d2g4: 32,
        d2b0: 33, d2b1: 34, d2b2: 35, d2b3: 36, d2b4: 37,
        d3r0: 38, d3r1: 39, d3r2: 40, d3r3: 41, d3r4: 42, d3r5: 43, d3r6: 44, 
        d3g0: 45, d3g1: 46, d3g2: 47, d3g3: 48, d3g4: 49, d3g5: 50, d3g6: 51, 
        d3b0: 52, d3b1: 53, d3b2: 54, d3b3: 55, d3b4: 56, d3b5: 57, d3b6: 58,
        total: 59, 
    };
    static unit8PackRangeMin = -1.0;
    static unit8PackRangeMax = 1.0;
    static identifyGSType(offsets) {
        // a little hack, we only check f_rest_x to differ from 3dgs and spacetime
        const keysToCheck = [
            'f_rest_0',
        ];
        const res = keysToCheck.every(key => offsets.has(key));
        if (res) {
            GSKernel_3DGS.updateOffsets(offsets);
        }
        return res;
    }
    static config = {
        low : {
            pospad: {
                name: 'Pos6Pad2',
                bytesPerTexel: 3 * 2 + 2,
                texelPerSplat: 1,
                format: "RGBA16F",
                array: 1,
            },
            covcol: {
                name: 'Cov12Col4',
                bytesPerTexel: 2 * 6 + 4,
                texelPerSplat: 1,
                format: "RGBA32UI",
                array: 1,
            },
            sh: {  // deg 0
                name: 'SH0',
                bytesPerTexel: 0,
                texelPerSplat: 0,
                format: "",
                array: 0,
                deg: 0,
            },
        },
        medium: {
            pospad: {
                name: 'Pos6Pad2',
                bytesPerTexel: 3 * 2 + 2,
                texelPerSplat: 1,
                format: "RGBA16F",
                array: 1,
            },
            covcol: {
                name: 'Cov12Col4',
                bytesPerTexel: 2 * 6 + 4,
                texelPerSplat: 1,
                format: "RGBA32UI",
                array: 1,
            },
            sh: {   // deg 1
                name: 'SH9Pad3',
                bytesPerTexel: 12,
                texelPerSplat: 1,
                format: "RGB32UI",
                array: 1,
                deg: 1,
            },
        },
        high: {
            pospad: {
                name: 'Pos12Pad4',
                bytesPerTexel: 3 * 4 + 4,
                texelPerSplat: 1,
                format: "RGBA32F",
                array: 1,
            },
            covcol: {
                name: 'Cov12Col4',
                bytesPerTexel: 2 * 6 + 4,
                texelPerSplat: 1,
                format: "RGBA32UI",
                array: 1,
            },
            sh: { // deg 2
                name: 'SH24',
                bytesPerTexel: 12,
                texelPerSplat: 2,
                format: "RGB32UI",
                array: 1,
                deg: 2,
            },
        }
    }

    static updateOffsets = function() {
        
        return function(offsets) {
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.x] = (offsets.get("x") / 4)>>>0;
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.y] = (offsets.get("y") / 4)>>>0;
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.z] = (offsets.get("z") / 4)>>>0;
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.sx] = (offsets.get("scale_0") / 4)>>>0;
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.sy] = (offsets.get("scale_1") / 4)>>>0;
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.sz] = (offsets.get("scale_2") / 4)>>>0;
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.rx] = (offsets.get("rot_1") / 4)>>>0;
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.ry] = (offsets.get("rot_2") / 4)>>>0;
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.rz] = (offsets.get("rot_3") / 4)>>>0;
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.rw] = (offsets.get("rot_0") / 4)>>>0;
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.cr] = (offsets.get("f_dc_0") / 4)>>>0;
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.cg] = (offsets.get("f_dc_1") / 4)>>>0;
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.cb] = (offsets.get("f_dc_2") / 4)>>>0;
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.ca] = (offsets.get("opacity") / 4)>>>0;
            for (let i = 0; i < 3; ++i) {
                GSKernel_3DGS.offsets[GSKernel_3DGS.params.d1r0 + i] = (offsets.get("f_rest_" + ( 0 + i)) / 4)>>>0;
                GSKernel_3DGS.offsets[GSKernel_3DGS.params.d1g0 + i] = (offsets.get("f_rest_" + (15 + i)) / 4)>>>0;
                GSKernel_3DGS.offsets[GSKernel_3DGS.params.d1b0 + i] = (offsets.get("f_rest_" + (30 + i)) / 4)>>>0;
            }
            for (let i = 0; i < 5; ++i) {
                GSKernel_3DGS.offsets[GSKernel_3DGS.params.d2r0 + i] = (offsets.get("f_rest_" + ( 0 + 3 + i)) / 4)>>>0;
                GSKernel_3DGS.offsets[GSKernel_3DGS.params.d2g0 + i] = (offsets.get("f_rest_" + (15 + 3 + i)) / 4)>>>0;
                GSKernel_3DGS.offsets[GSKernel_3DGS.params.d2b0 + i] = (offsets.get("f_rest_" + (30 + 3 + i)) / 4)>>>0;
            }
            for (let i = 0; i < 7; ++i) {
                GSKernel_3DGS.offsets[GSKernel_3DGS.params.d3r0 + i] = (offsets.get("f_rest_" + ( 0 + 8 + i)) / 4)>>>0;
                GSKernel_3DGS.offsets[GSKernel_3DGS.params.d3g0 + i] = (offsets.get("f_rest_" + (15 + 8 + i)) / 4)>>>0;
                GSKernel_3DGS.offsets[GSKernel_3DGS.params.d3b0 + i] = (offsets.get("f_rest_" + (30 + 8 + i)) / 4)>>>0;
            }
            GSKernel_3DGS.offsets[GSKernel_3DGS.params.total] = (offsets.get("total") / 4)>>>0;
        }
    }();

    static parseSplatFromData = function() {
        const SH_C0 = 0.28209479177387814;

        return function(idx, splat, dataview) {
            const splatBytesOffset = idx * GSKernel_3DGS.offsets[GSKernel_3DGS.params.total] * 4;
            Object.keys(splat).forEach(key => {
                if(key === 'total') return;
                splat[key] = dataview.getFloat32(splatBytesOffset + GSKernel_3DGS.offsets[GSKernel_3DGS.params[key]] * 4, true);
            });
            splat.sx = Math.exp(splat.sx);
            splat.sy = Math.exp(splat.sy);
            splat.sz = Math.exp(splat.sz);
            splat.cr = Utils.clamp(0.5 + SH_C0 * splat.cr, 0, 1);
            splat.cg = Utils.clamp(0.5 + SH_C0 * splat.cg, 0, 1);
            splat.cb = Utils.clamp(0.5 + SH_C0 * splat.cb, 0, 1);
            splat.ca = Utils.sigmoid(splat.ca);
        }
    }();

    static parsePlyData2Buffers = function() {

        return function(pointCount, file, quality = 'medium') {
            // a little hack, pointCount shouldn't be too large (<= 8,388,608)
            if (pointCount > 4096 * 2048) {
                console.warn(`pointCount ${pointCount} is too large and is clamped to 8,388,608`);
                pointCount = 4096 * 2048;
            }
            const dataview = new DataView(file.data, file.headerEnd);

            const buffers = GSKernel_3DGS.config[quality];
            const pospad = buffers.pospad;
            const covcol = buffers.covcol;
            const sh     = buffers.sh;

            Object.assign(pospad, Utils.computeTexSize(pospad.texelPerSplat * pointCount));
            Object.assign(covcol, Utils.computeTexSize(covcol.texelPerSplat * pointCount));
            Object.assign(sh, Utils.computeTexSize(sh.texelPerSplat * pointCount));

            // TODO: deg 0 and deg1 and deg3
            pospad.buffer = new ArrayBuffer(pospad.width * pospad.height * pospad.bytesPerTexel);
            covcol.buffer = new ArrayBuffer(covcol.width * covcol.height * covcol.bytesPerTexel);
            sh.buffer = new ArrayBuffer(sh.width * sh.height * sh.bytesPerTexel);
            const sortBuffer = new Int32Array(pointCount * 4);

            const pospadView = new DataView(pospad.buffer);
            const covcolView = new DataView(covcol.buffer);
            const shView = new DataView(sh.buffer);
            const splat = {...GSKernel_3DGS.params};
            let pospadOffset = 0, covcolOffset = 0, shOffset = 0, sortOffset = 0;
            for (let i = 0;i < pointCount; ++i) {
                GSKernel_3DGS.parseSplatFromData(i, splat, dataview);

                if (pospad.bytesPerTexel == 8) {
                    // TODO: test if using fp16 affects the quality, for now we dont use it
                    pospadView.setUint16(pospadOffset + 0, Utils.f2fp162uint16(splat.x), true);
                    pospadView.setUint16(pospadOffset + 2, Utils.f2fp162uint16(splat.y), true);
                    pospadView.setUint16(pospadOffset + 4, Utils.f2fp162uint16(splat.z), true);
                } else {
                    pospadView.setFloat32(pospadOffset + 0, splat.x, true);
                    pospadView.setFloat32(pospadOffset + 4, splat.y, true);
                    pospadView.setFloat32(pospadOffset + 8, splat.z, true);
                }
                
                Utils.computeCov3dPack2fp16(
                    splat.sx, splat.sy, splat.sz, splat.rx, splat.ry, splat.rz, splat.rw, 
                    covcolView, covcolOffset
                );
                Utils.packFloat2rgba(
                    splat.cr, splat.cg, splat.cb, splat.ca,
                    covcolView, covcolOffset + 12
                );
                if (sh.deg >= 1) {
                    for(let j = 0;j < 3;++j) {
                        shView.setUint8(shOffset + 3 * j + 0, Utils.float2uint8(splat['d1r' + j], GSKernel_3DGS.unit8PackRangeMin, GSKernel_3DGS.unit8PackRangeMax));
                        shView.setUint8(shOffset + 3 * j + 1, Utils.float2uint8(splat['d1g' + j], GSKernel_3DGS.unit8PackRangeMin, GSKernel_3DGS.unit8PackRangeMax));
                        shView.setUint8(shOffset + 3 * j + 2, Utils.float2uint8(splat['d1b' + j], GSKernel_3DGS.unit8PackRangeMin, GSKernel_3DGS.unit8PackRangeMax));
                    }
                    if (sh.deg >= 2) {
                        for(let j = 0;j < 5;++j) {
                            shView.setUint8(shOffset + 9 + 3 * j + 0, Utils.float2uint8(splat['d2r' + j], GSKernel_3DGS.unit8PackRangeMin, GSKernel_3DGS.unit8PackRangeMax));
                            shView.setUint8(shOffset + 9 + 3 * j + 1, Utils.float2uint8(splat['d2g' + j], GSKernel_3DGS.unit8PackRangeMin, GSKernel_3DGS.unit8PackRangeMax));
                            shView.setUint8(shOffset + 9 + 3 * j + 2, Utils.float2uint8(splat['d2b' + j], GSKernel_3DGS.unit8PackRangeMin, GSKernel_3DGS.unit8PackRangeMax));
                        }
                        // we don't use deg3 for now
                        /*if (sh.deg >= 3) {
                            for(let j = 0;j < 7;++j) {
                                shView.setUint8(shOffset + 24 + 3 * j + 0, Utils.float2uint8(splat['d3r' + j], unit8PackRangeMin, unit8PackRangeMax));
                                shView.setUint8(shOffset + 24 + 3 * j + 1, Utils.float2uint8(splat['d3g' + j], unit8PackRangeMin, unit8PackRangeMax));
                                shView.setUint8(shOffset + 24 + 3 * j + 2, Utils.float2uint8(splat['d3b' + j], unit8PackRangeMin, unit8PackRangeMax));
                            }
                        }*/
                    }
                }

                sortBuffer[sortOffset + 0] = Math.round(splat.x * 1000.0);
                sortBuffer[sortOffset + 1] = Math.round(splat.y * 1000.0);
                sortBuffer[sortOffset + 2] = Math.round(splat.z * 1000.0);
                sortBuffer[sortOffset + 3] = 1000;
                
                pospadOffset += pospad.bytesPerTexel * pospad.texelPerSplat;
                covcolOffset += covcol.bytesPerTexel * covcol.texelPerSplat;
                shOffset += sh.bytesPerTexel * sh.texelPerSplat;
                sortOffset += 4;
            }

            if (sh.deg == 0) {
                delete buffers.sh;
            }

            return {
                valid: true,
                data: {
                    buffers: buffers,
                    file: file,
                    gsType: 'ThreeD',
                    num: pointCount,
                    sortBuffer: sortBuffer.buffer,
                    quality: quality,
                },
            }
        }
    }();

    static parseSpbData2Buffers(descriptor, file) {
        const arrayBuffer = file.data;
        const quality = descriptor.quality;
        const pointCount = descriptor.num;
        const buffers = {...GSKernel_3DGS.config[quality]};
        const pospad = buffers.pospad;
        const covcol = buffers.covcol;
        const sh = buffers.sh;

        pospad.offset = descriptor.buffers.bind0.offset;
        covcol.offset = descriptor.buffers.bind1.offset;
        sh.offset = descriptor.buffers.bind2.offset;

        Object.assign(pospad, Utils.computeTexSize(pospad.texelPerSplat * pointCount));
        Object.assign(covcol, Utils.computeTexSize(covcol.texelPerSplat * pointCount));
        Object.assign(sh, Utils.computeTexSize(sh.texelPerSplat * pointCount));

        // TODO: deg 0 and deg1 and deg3
        if (descriptor.pad) {
            pospad.buffer = arrayBuffer.slice(pospad.offset, pospad.offset + pospad.width * pospad.height * pospad.bytesPerTexel);
            covcol.buffer = arrayBuffer.slice(covcol.offset, covcol.offset + covcol.width * covcol.height * covcol.bytesPerTexel);
            sh.buffer = arrayBuffer.slice(sh.offset, sh.offset + sh.width * sh.height * sh.bytesPerTexel);
        } else {
            let sliceEnd = pospad.offset + pospad.width * pospad.height * pospad.bytesPerTexel;
            if (sliceEnd <= arrayBuffer.byteLength) {
                pospad.buffer = arrayBuffer.slice(pospad.offset, sliceEnd);
            } else {
                pospad.buffer = new ArrayBuffer(pospad.width * pospad.height * pospad.bytesPerTexel);
                new Uint8Array(pospad.buffer).set(new Uint8Array(arrayBuffer, pospad.offset));
            }
            sliceEnd = covcol.offset + covcol.width * covcol.height * covcol.bytesPerTexel;
            if (sliceEnd <= arrayBuffer.byteLength) {
                covcol.buffer = arrayBuffer.slice(covcol.offset, sliceEnd);
            } else {
                covcol.buffer = new ArrayBuffer(covcol.width * covcol.height * covcol.bytesPerTexel);
                new Uint8Array(covcol.buffer).set(new Uint8Array(arrayBuffer, covcol.offset));
            }
            sliceEnd = sh.offset + sh.width * sh.height * sh.bytesPerTexel;
            if (sliceEnd <= arrayBuffer.byteLength) {
                sh.buffer = arrayBuffer.slice(sh.offset, sliceEnd);
            } else {
                sh.buffer = new ArrayBuffer(sh.width * sh.height * sh.bytesPerTexel);
                new Uint8Array(sh.buffer).set(new Uint8Array(arrayBuffer, sh.offset));
            }
        }
        
        const sortBuffer = new Int32Array(pointCount * 4);
        const dataview = new DataView(pospad.buffer);
        let offset = 0, sortOffset = 0;
        if (quality == "high") {
            for (let i = 0;i < pointCount; ++i) {
                sortBuffer[sortOffset + 0] = Math.round(dataview.getFloat32(offset + 0, true) * 1000.0);
                sortBuffer[sortOffset + 1] = Math.round(dataview.getFloat32(offset + 4, true) * 1000.0);
                sortBuffer[sortOffset + 2] = Math.round(dataview.getFloat32(offset + 8, true) * 1000.0);
                sortBuffer[sortOffset + 3] = 1000;
                offset += 16;
                sortOffset += 4;
            }
        } else {
            for (let i = 0;i < pointCount; ++i) {
                sortBuffer[sortOffset + 0] = Math.round(Utils.readFp16(dataview, offset + 0, true) * 1000.0);
                sortBuffer[sortOffset + 1] = Math.round(Utils.readFp16(dataview, offset + 2, true) * 1000.0);
                sortBuffer[sortOffset + 2] = Math.round(Utils.readFp16(dataview, offset + 4, true) * 1000.0);
                sortBuffer[sortOffset + 3] = 1000;
                offset += 8;
                sortOffset += 4;
            }
        }

        if (sh.deg == 0) {
            delete buffers.sh;
        }
        
        return {
            valid: true,
            data: {
                buffers: buffers,
                file: file,
                gsType: 'ThreeD',
                num: pointCount,
                sortBuffer: sortBuffer.buffer,
                quality: quality,
            },
        }
    }

    static getUniformDefines() {
        return `
            // 3dgs specific uniforms
            // nothing
        `;
    }

    static getFetchFunc(buffers) {
        let res = ``;
        const pospad = buffers.pospad;
        if (pospad) {
            res += `
                void fetchCenter(in uint splatIndex, inout vec3 center)
                {
                    center = vec3(texelFetch(${pospad.name}, index2uv(splatIndex, ${pospad.texelPerSplat}u, 0u, textureSize(${pospad.name}, 0)), 0));
                }
            `
        }
        const covcol = buffers.covcol;
        if (covcol) {
            res += `
                void fetchCovCol(in uint splatIndex, inout mat3 cov3d, inout vec4 color)
                {
                    uvec4 texel = texelFetch(${covcol.name}, index2uv(splatIndex, ${covcol.texelPerSplat}u, 0u, textureSize(${covcol.name}, 0)), 0);
                    vec2 cov01 = uint2fp16x2(texel.x);
                    vec2 cov24 = uint2fp16x2(texel.y);
                    vec2 cov58 = uint2fp16x2(texel.z);
                    cov3d = mat3(
                        cov01.x, cov01.y, cov24.x,
                        cov01.y, cov24.y, cov58.x,
                        cov24.x, cov58.x, cov58.y
                    );
                    color = uint2rgba(texel.w);
                }
            `
        }
        const sh = buffers.sh;
        if (sh) {
            const deg2 = sh.deg === 2;
            const range = (GSKernel_3DGS.unit8PackRangeMax - GSKernel_3DGS.unit8PackRangeMin).toFixed(5);
            const min = GSKernel_3DGS.unit8PackRangeMin.toFixed(5);
            res += `
                void fetchSH(in uint splatIndex, inout vec3 shd1[3]${deg2 ? `, inout vec3 shd2[5]` : ``})
                {
                    uvec4 texel = texelFetch(${sh.name}, index2uv(splatIndex, ${sh.texelPerSplat}u, 0u, textureSize(${sh.name}, 0)), 0);
                    vec4 sh00_03 = uint2rgba(texel.x);
                    vec4 sh04_07 = uint2rgba(texel.y);
                    vec4 sh08_11 = uint2rgba(texel.z);
                    shd1[0] = vec3(sh00_03.x, sh00_03.y, sh00_03.z) * ${range} + (${min});
                    shd1[1] = vec3(sh00_03.w, sh04_07.x, sh04_07.y) * ${range} + (${min});
                    shd1[2] = vec3(sh04_07.z, sh04_07.w, sh08_11.x) * ${range} + (${min});
                    ${deg2 ? `
                    texel = texelFetch(${sh.name}, index2uv(splatIndex, ${sh.texelPerSplat}u, 1u, textureSize(${sh.name}, 0)), 0);
                    vec4 sh12_15 = uint2rgba(texel.x);
                    vec4 sh16_19 = uint2rgba(texel.y);
                    vec4 sh20_23 = uint2rgba(texel.z);
                    shd2[0] = vec3(sh08_11.y, sh08_11.z, sh08_11.w) * ${range} + (${min});
                    shd2[1] = vec3(sh12_15.x, sh12_15.y, sh12_15.z) * ${range} + (${min});
                    shd2[2] = vec3(sh12_15.w, sh16_19.x, sh16_19.y) * ${range} + (${min});
                    shd2[3] = vec3(sh16_19.z, sh16_19.w, sh20_23.x) * ${range} + (${min});
                    shd2[4] = vec3(sh20_23.y, sh20_23.z, sh20_23.w) * ${range} + (${min});
                    ` : ``}
                }
            `
        }

        return res;
    }

    static getFetchParams(buffers) {
        let res = `
            fetchCenter(splatIndex, splatCenter);
            fetchCovCol(splatIndex, Vrk, splatColor);
        `

        return res;
    }

    static getSpecificCode(buffers) {
        const sh = buffers.sh;
        let res = ``;
        if (sh) {
            const deg2 = sh.deg === 2;
            res += `
            {
                vec3 shd1[3];
                ${deg2 ? `vec3 shd2[5];` : ``}
                fetchSH(splatIndex, shd1${deg2 ? `, shd2` : ``});

                vec3 worldViewDir = normalize(splatCenter - cameraPosition);
                float x = worldViewDir.x;
                float y = worldViewDir.y;
                float z = worldViewDir.z;
                splatColor.rgb += SH_C1 * (-shd1[0] * y + shd1[1] * z - shd1[2] * x);

                ${deg2 ? `
                float xx = x * x;
                float yy = y * y;
                float zz = z * z;
                float xy = x * y;
                float yz = y * z;
                float xz = x * z;

                splatColor.rgb += (SH_C2[0] * xy) * shd2[0] + (SH_C2[1] * yz) * shd2[1] + (SH_C2[2] * (2.0 * zz - xx - yy)) * shd2[2]
                        + (SH_C2[3] * xz) * shd2[3] + (SH_C2[4] * (xx - yy)) * shd2[4];
                ` : ``}
            }`
        }
        return res;
    }
}