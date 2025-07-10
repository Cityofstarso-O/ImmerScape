import { Utils } from "../../Utils.js";

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

    static parseData2Buffers = function() {
        const config = {
            pospad: {
                low: {
                    name: 'Pos6Pad2',
                    bytesPerTexel: 3 * 2 + 2,
                    texelPerSplat: 1,
                    format: "RGBA16F",
                    array: 1,
                },
                medium: {
                    name: 'Pos12Pad4',
                    bytesPerTexel: 3 * 4 + 4,
                    texelPerSplat: 1,
                    format: "RGBA32F",
                    array: 1,
                },
            },
            covcol: {
                low: {
                    name: 'Cov12Col4',
                    bytesPerTexel: 2 * 6 + 4,
                    texelPerSplat: 1,
                    format: "RGBA32UI",
                    array: 1,
                },
            },
            sh: {
                low: {  // deg 0
                    name: '',
                    bytesPerTexel: 0,
                    texelPerSplat: 0,
                    format: "",
                    array: 0,
                    deg: 0,
                },
                medium: {   // deg 1
                    name: 'SH9Pad3',
                    bytesPerTexel: 12,
                    texelPerSplat: 1,
                    format: "RGB32UI",
                    array: 1,
                    deg: 1,
                },
                high: { // deg 2
                    name: 'SH24',
                    bytesPerTexel: 12,
                    texelPerSplat: 2,
                    format: "RGB32UI",
                    array: 1,
                    deg: 2,
                },
            },
        }
        const unit8PackRangeMin = -1.0;
        const unit8PackRangeMax = 1.0;

        return function(pointCount, dataview, quality = 'meduim') {
            // a little hack, pointCount shouldn't be too large (<= 8,388,608)
            if (pointCount > 4096 * 2048) {
                console.warn(`pointCount ${pointCount} is too large and is clamped to 8,388,608`);
                pointCount = 4096 * 2048;
            }

            let currentConfig = config.pospad[quality] || config.pospad.medium || config.pospad.low;
            const pospad = {...currentConfig};
            currentConfig = config.covcol[quality] || config.covcol.medium || config.covcol.low;
            const covcol = {...currentConfig};
            currentConfig = config.sh[quality] || config.sh.medium || config.sh.low;
            const sh = {...currentConfig};

            Object.assign(pospad, Utils.computeTexSize(pospad.texelPerSplat * pointCount));
            Object.assign(covcol, Utils.computeTexSize(covcol.texelPerSplat * pointCount));
            Object.assign(sh, Utils.computeTexSize(sh.texelPerSplat * pointCount));

            // TODO: deg 0 and deg1 and deg3
            pospad.buffer = new ArrayBuffer(pospad.width * pospad.height * pospad.bytesPerTexel);
            covcol.buffer = new ArrayBuffer(covcol.width * covcol.height * covcol.bytesPerTexel);
            sh.buffer = new ArrayBuffer(sh.width * sh.height * sh.bytesPerTexel);

            const pospadView = new DataView(pospad.buffer);
            const covcolView = new DataView(covcol.buffer);
            const shView = new DataView(sh.buffer);
            const splat = {...GSKernel_3DGS.params};
            let pospadOffset = 0, covcolOffset = 0, shOffset = 0;
            for (let i = 0;i < pointCount; ++i) {
                GSKernel_3DGS.parseSplatFromData(i, splat, dataview);

                pospadView.setFloat32(pospadOffset + 0, splat.x, true);
                pospadView.setFloat32(pospadOffset + 4, splat.y, true);
                pospadView.setFloat32(pospadOffset + 8, splat.z, true);

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
                        shView.setUint8(shOffset + 3 * j + 0, Utils.float2uint8(splat['d1r' + j], unit8PackRangeMin, unit8PackRangeMax));
                        shView.setUint8(shOffset + 3 * j + 1, Utils.float2uint8(splat['d1g' + j], unit8PackRangeMin, unit8PackRangeMax));
                        shView.setUint8(shOffset + 3 * j + 2, Utils.float2uint8(splat['d1b' + j], unit8PackRangeMin, unit8PackRangeMax));
                    }
                    if (sh.deg >= 2) {
                        for(let j = 0;j < 5;++j) {
                            shView.setUint8(shOffset + 9 + 3 * j + 0, Utils.float2uint8(splat['d2r' + j], unit8PackRangeMin, unit8PackRangeMax));
                            shView.setUint8(shOffset + 9 + 3 * j + 1, Utils.float2uint8(splat['d2g' + j], unit8PackRangeMin, unit8PackRangeMax));
                            shView.setUint8(shOffset + 9 + 3 * j + 2, Utils.float2uint8(splat['d2b' + j], unit8PackRangeMin, unit8PackRangeMax));
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
                
                pospadOffset += pospad.bytesPerTexel * pospad.texelPerSplat;
                covcolOffset += covcol.bytesPerTexel * covcol.texelPerSplat;
                shOffset += sh.bytesPerTexel * sh.texelPerSplat;
            }

            const data = {pospad, covcol};
            if (sh.deg >= 1) {
                data.sh = sh;
            }

            return {
                valid: true,
                data: data,
            }
        }
    }();
}