import { Utils } from "../../Utils.js";

export class GSKernel_3DGS {
    static offsets = [];
    static params = {
        x: 0, y: 1, z: 2,
        sx: 3, sx: 4, sx: 5,
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

    static parseSplatFromData(idx, splat, dataf32) {
        const splatOffset = idx * GSKernel_3DGS.params.total;
        Object.keys(splat).forEach(key => {
            splat[key] = dataf32[splatOffset + GSKernel_3DGS.offsets[GSKernel_3DGS.params[key]]];
        });
    }

    static parseData2Buffers = function() {
        const config = {
            poscol: 4 * 3 + 4,
            covpad: 2 * 6 + 4,
            sh: 24 * 1,
        }
        const SH_C0 = 0.28209479177387814;
        const unit8PackRangeMin = -1.0;
        const unit8PackRangeMax = 1.0;


        return function(pointCount, data) {
            const poscolSize = config.poscol * pointCount;
            const covpadSize = config.covpad * pointCount;
            const shSize = config.sh * pointCount;
            // TODO: deg 0 and deg1 and deg3
            if (4096 * 4096 * 12 / 24 <= pointCount) {
                return {
                    valid: false,
                    error: `point count ${pointCount} exceeds 4096 * 4096 * 12 / 24`,
                }
            }
            const poscolBuf = new ArrayBuffer(poscolSize);
            const covpadBuf = new ArrayBuffer(covpadSize);
            const shBuf = new ArrayBuffer(shSize);

            const poscolView = new DataView(poscolBuf);
            const covpadView = new DataView(covpadBuf);
            const shView = new DataView(shBuf);

            const dataf32 = new Float32Array(data);
            const splat = {...GSKernel_3DGS.params};
            let poscolOffset = 0, covpadOffset = 0, shOffset = 0;
            for (let i = 0;i < pointCount; ++i) {
                GSKernel_3DGS.parseSplatFromData(i, splat, dataf32);

                poscolView.setFloat32(poscolOffset + 0, splat.x, true);
                poscolView.setFloat32(poscolOffset + 4, splat.y, true);
                poscolView.setFloat32(poscolOffset + 8, splat.z, true);
                Utils.packFloat2rgba(
                    0.5 + SH_C0 * splat.r, 0.5 + SH_C0 * splat.g, 0.5 + SH_C0 * splat.b, Utils.sigmoid(splat.a),
                    poscolView, poscolOffset + 12
                );

                Utils.computeCov3dPack2fp16(
                    splat.sx, splat.sy, splat.sz, splat.rx, splat.ry, splat.rz, splat.rw, 
                    covpadView, covpadOffset
                );

                for(let j = 0;j < 3;++j) {
                    shView.setUint8(shOffset + 3 * j + 0, Utils.float2uint8(splat['d1r' + j], unit8PackRangeMin, unit8PackRangeMax));
                    shView.setUint8(shOffset + 3 * j + 1, Utils.float2uint8(splat['d1g' + j], unit8PackRangeMin, unit8PackRangeMax));
                    shView.setUint8(shOffset + 3 * j + 2, Utils.float2uint8(splat['d1b' + j], unit8PackRangeMin, unit8PackRangeMax));
                }

                for(let j = 0;j < 5;++j) {
                    shView.setUint8(shOffset + 9 + 3 * j + 0, Utils.float2uint8(splat['d2r' + j], unit8PackRangeMin, unit8PackRangeMax));
                    shView.setUint8(shOffset + 9 + 3 * j + 1, Utils.float2uint8(splat['d2g' + j], unit8PackRangeMin, unit8PackRangeMax));
                    shView.setUint8(shOffset + 9 + 3 * j + 2, Utils.float2uint8(splat['d2b' + j], unit8PackRangeMin, unit8PackRangeMax));
                }

                // we don't use deg3 for now
                /*for(let j = 0;j < 7;++j) {
                    shView.setUint8(shOffset + 24 + 3 * j + 0, Utils.float2uint8(splat['d3r' + j], unit8PackRangeMin, unit8PackRangeMax));
                    shView.setUint8(shOffset + 24 + 3 * j + 1, Utils.float2uint8(splat['d3g' + j], unit8PackRangeMin, unit8PackRangeMax));
                    shView.setUint8(shOffset + 24 + 3 * j + 2, Utils.float2uint8(splat['d3b' + j], unit8PackRangeMin, unit8PackRangeMax));
                }*/

                poscolOffset += config.poscol;
                covpadOffset += config.covpad;
                shOffset += config.sh;
            }

            return {
                valid: true,
                data: {
                    poscol: {
                        bytesPerTexel: config.poscol,
                        buffer: poscolBuf,
                    },
                    covpad: {
                        bytesPerTexel: config.covpad,
                        buffer: covpadBuf,
                    },
                    sh: {
                        bytesPerTexel: config.sh,
                        buffer: shBuf,
                    },
                }
            }
        }
    }();
}