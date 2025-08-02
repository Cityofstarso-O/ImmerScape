import { Utils } from "../Utils.js";

export class GSKernel_SPACETIME {
    static offsets = [];
    static params = {
        x: 0, y: 1, z: 2,
        pos1x: 3, pos1y: 4, pos1z: 5, 
        pos2x: 6, pos2y: 7, pos2z: 8, 
        pos3x: 9, pos3y: 10, pos3z: 11, 
        sx: 12, sy: 13, sz: 14,
        rx: 15, ry: 16, rz: 17, rw: 18,
        rot1x: 19, rot1y: 20, rot1z: 21, rot1w: 22, 
        cr: 23, cg: 24, cb: 25, ca: 26,
        tc: 27, ts: 28, 
        total: 29, 
    };
    static unit8PackRangeMin = -1.0;
    static unit8PackRangeMax = 1.0;
    static identifyGSType(offsets) {
        // a little hack, we only check f_rest_x to differ from 3dgs and spacetime
        const keysToCheck = [
            'trbf_center',
        ];
        const res = keysToCheck.every(key => offsets.has(key));
        if (res) {
            GSKernel_SPACETIME.updateOffsets(offsets);
        }
        return res;
    }

    static updateOffsets = function() {
        
        return function(offsets) {
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.x] = (offsets.get("x") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.y] = (offsets.get("y") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.z] = (offsets.get("z") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.sx] = (offsets.get("scale_0") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.sy] = (offsets.get("scale_1") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.sz] = (offsets.get("scale_2") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.rx] = (offsets.get("rot_1") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.ry] = (offsets.get("rot_2") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.rz] = (offsets.get("rot_3") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.rw] = (offsets.get("rot_0") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.rot1x] = (offsets.get("omega_1") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.rot1y] = (offsets.get("omega_2") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.rot1z] = (offsets.get("omega_3") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.rot1w] = (offsets.get("omega_0") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.cr] = (offsets.get("f_dc_0") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.cg] = (offsets.get("f_dc_1") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.cb] = (offsets.get("f_dc_2") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.ca] = (offsets.get("opacity") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.tc] = (offsets.get("trbf_center") / 4)>>>0;
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.ts] = (offsets.get("trbf_scale") / 4)>>>0;
            for (let i = 0; i < 9; ++i) {
                GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.pos1x + i] = (offsets.get("motion_" + i) / 4)>>>0;
            }
            GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.total] = (offsets.get("total") / 4)>>>0;
        }
    }();

    static parseSplatFromData = function() {

        return function(idx, splat, dataview) {
            const splatBytesOffset = idx * GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params.total] * 4;
            Object.keys(splat).forEach(key => {
                if(key === 'total') return;
                splat[key] = dataview.getFloat32(splatBytesOffset + GSKernel_SPACETIME.offsets[GSKernel_SPACETIME.params[key]] * 4, true);
            });
            splat.sx = Math.exp(splat.sx);
            splat.sy = Math.exp(splat.sy);
            splat.sz = Math.exp(splat.sz);
            splat.ca = Utils.sigmoid(splat.ca);
            const exp_minus_ts = Math.exp(-splat.ts);
            splat.ts = exp_minus_ts * exp_minus_ts;
        }
    }();

    static parseData2Buffers = function() {
        const config = {
            poscol: {
                low: {
                    name: 'Pos12Col4',
                    bytesPerTexel: 3 * 4 + 4,
                    texelPerSplat: 1,
                    format: "RGBA32F",
                    array: 1,
                },
            },
            rot: {
                low: {
                    name: 'Rot8Omega8',
                    bytesPerTexel: 2 * 4 * 2,
                    texelPerSplat: 1,
                    format: "RGBA32UI",
                    array: 1,
                },
            },
            other: {
                low: {
                    name: 'Motion18Scale6Tc4Ts4',
                    bytesPerTexel: 16,
                    texelPerSplat: 2,
                    format: "RGBA32UI",
                    array: 1,
                },
            },
        }

        return function(pointCount, dataview, quality = 'medium') {
            // a little hack, pointCount shouldn't be too large (<= 8,388,608)
            if (pointCount > 4096 * 2048) {
                console.warn(`pointCount ${pointCount} is too large and is clamped to 8,388,608`);
                pointCount = 4096 * 2048;
            }

            let currentConfig = config.poscol[quality] || config.poscol.medium || config.poscol.low;
            const poscol = {...currentConfig};
            currentConfig = config.rot[quality] || config.rot.medium || config.rot.low;
            const rot = {...currentConfig};
            currentConfig = config.other[quality] || config.other.medium || config.other.low;
            const other = {...currentConfig};

            Object.assign(poscol, Utils.computeTexSize(poscol.texelPerSplat * pointCount));
            Object.assign(rot, Utils.computeTexSize(rot.texelPerSplat * pointCount));
            Object.assign(other, Utils.computeTexSize(other.texelPerSplat * pointCount));

            poscol.buffer = new ArrayBuffer(poscol.width * poscol.height * poscol.bytesPerTexel);
            rot.buffer = new ArrayBuffer(rot.width * rot.height * rot.bytesPerTexel);
            other.buffer = new ArrayBuffer(other.width * other.height * other.bytesPerTexel);
            const sortBuffer = new Float32Array(pointCount * 13);

            const poscolView = new DataView(poscol.buffer);
            const rotView = new DataView(rot.buffer);
            const otherView = new DataView(other.buffer);
            const splat = {...GSKernel_SPACETIME.params};
            let poscolOffset = 0, rotOffset = 0, otherOffset = 0, sortOffset = 0;
            for (let i = 0;i < pointCount; ++i) {
                GSKernel_SPACETIME.parseSplatFromData(i, splat, dataview);
                poscolView.setFloat32(poscolOffset + 0, splat.x, true);
                poscolView.setFloat32(poscolOffset + 4, splat.y, true);
                poscolView.setFloat32(poscolOffset + 8, splat.z, true);
                Utils.packFloat2rgba(
                    splat.cr, splat.cg, splat.cb, splat.ca,
                    poscolView, poscolOffset + 12
                );
                rotView.setUint16(rotOffset +  0, Utils.f2fp162uint16(splat.rx), true);
                rotView.setUint16(rotOffset +  2, Utils.f2fp162uint16(splat.ry), true);
                rotView.setUint16(rotOffset +  4, Utils.f2fp162uint16(splat.rz), true);
                rotView.setUint16(rotOffset +  6, Utils.f2fp162uint16(splat.rw), true);
                rotView.setUint16(rotOffset +  8, Utils.f2fp162uint16(splat.rot1x), true);
                rotView.setUint16(rotOffset + 10, Utils.f2fp162uint16(splat.rot1y), true);
                rotView.setUint16(rotOffset + 12, Utils.f2fp162uint16(splat.rot1z), true);
                rotView.setUint16(rotOffset + 14, Utils.f2fp162uint16(splat.rot1w), true);
                
                otherView.setUint16(otherOffset +  0, Utils.f2fp162uint16(splat.pos1x), true);
                otherView.setUint16(otherOffset +  2, Utils.f2fp162uint16(splat.pos1y), true);
                otherView.setUint16(otherOffset +  4, Utils.f2fp162uint16(splat.pos1z), true);
                otherView.setUint16(otherOffset +  6, Utils.f2fp162uint16(splat.pos2x), true);
                otherView.setUint16(otherOffset +  8, Utils.f2fp162uint16(splat.pos2y), true);
                otherView.setUint16(otherOffset + 10, Utils.f2fp162uint16(splat.pos2z), true);
                otherView.setUint16(otherOffset + 12, Utils.f2fp162uint16(splat.pos3x), true);
                otherView.setUint16(otherOffset + 14, Utils.f2fp162uint16(splat.pos3y), true);
                otherView.setUint16(otherOffset + 16, Utils.f2fp162uint16(splat.pos3z), true);
                otherView.setUint16(otherOffset + 18, Utils.f2fp162uint16(splat.sx), true);
                otherView.setUint16(otherOffset + 20, Utils.f2fp162uint16(splat.sy), true);
                otherView.setUint16(otherOffset + 22, Utils.f2fp162uint16(splat.sz), true);
                otherView.setFloat32(otherOffset + 24, splat.tc, true);
                otherView.setFloat32(otherOffset + 28, splat.ts, true);

                sortBuffer[sortOffset +  0] = splat.x;
                sortBuffer[sortOffset +  1] = splat.pos1x;
                sortBuffer[sortOffset +  2] = splat.pos2x;
                sortBuffer[sortOffset +  3] = splat.pos3x;
                sortBuffer[sortOffset +  4] = splat.y;
                sortBuffer[sortOffset +  5] = splat.pos1y;
                sortBuffer[sortOffset +  6] = splat.pos2y;
                sortBuffer[sortOffset +  7] = splat.pos3y;
                sortBuffer[sortOffset +  8] = splat.z;
                sortBuffer[sortOffset +  9] = splat.pos1z;
                sortBuffer[sortOffset + 10] = splat.pos2z;
                sortBuffer[sortOffset + 11] = splat.pos3z;
                sortBuffer[sortOffset + 12] = splat.tc;
                
                poscolOffset += poscol.bytesPerTexel * poscol.texelPerSplat;
                rotOffset += rot.bytesPerTexel * rot.texelPerSplat;
                otherOffset += other.bytesPerTexel * other.texelPerSplat;
                sortOffset += 13;
            }

            const buffers = { poscol, rot, other };

            return {
                valid: true,
                data: {
                    buffers: buffers,
                    gsType: 'SPACETIME',
                    num: pointCount,
                    sortBuffer: sortBuffer.buffer,
                },
            }
        }
    }();

    static getUniformDefines() {
        return `
            // spacetime specific uniforms
            uniform float timestamp;
        `;
    }

    static getFetchFunc(buffers) {
        let res = ``;
        const poscol = buffers.poscol;
        if (poscol) {
            res += `
                void fetchCenterColor(in uint splatIndex, inout vec3 center, inout vec4 color)
                {
                    vec4 texel = texelFetch(${poscol.name}, index2uv(splatIndex, ${poscol.texelPerSplat}u, 0u, textureSize(${poscol.name}, 0)), 0);
                    center = texel.xyz;
                    color = uint2rgba(floatBitsToUint(texel.w));
                }
            `
        }
        const rot = buffers.rot;
        if (rot) {
            res += `
                void fetchRot(in uint splatIndex, in float deltaT, inout mat3 rot)
                {
                    uvec4 texel = texelFetch(${rot.name}, index2uv(splatIndex, ${rot.texelPerSplat}u, 0u, textureSize(${rot.name}, 0)), 0);
                    vec2 unpack16x2;
                    vec4 q;
                    unpack16x2 = uint2fp16x2(texel.x);
                    q.x = unpack16x2.x; q.y = unpack16x2.y;
                    unpack16x2 = uint2fp16x2(texel.y);
                    q.z = unpack16x2.x; q.w = unpack16x2.y;
                    vec4 omega;
                    unpack16x2 = uint2fp16x2(texel.z);
                    omega.x = unpack16x2.x; omega.y = unpack16x2.y;
                    unpack16x2 = uint2fp16x2(texel.w);
                    omega.z = unpack16x2.x; omega.w = unpack16x2.y;
                    
                    q = q + deltaT * omega;
                    q = normalize(q);

                    float xx = q.x * q.x;
                    float yy = q.y * q.y;
                    float zz = q.z * q.z;
                    float xy = q.x * q.y;
                    float xz = q.x * q.z;
                    float yz = q.y * q.z;
                    float wx = q.w * q.x;
                    float wy = q.w * q.y;
                    float wz = q.w * q.z;
                    rot = mat3(
                        1.0 - 2.0 * (yy + zz), 2.0 * (xy + wz), 2.0 * (xz - wy),
                        2.0 * (xy - wz), 1.0 - 2.0 * (xx + zz), 2.0 * (yz + wx),
                        2.0 * (xz + wy), 2.0 * (yz - wx), 1.0 - 2.0 * (xx + yy)
                    );
                }
            `
        }
        const other = buffers.other;
        if (other) {
            res += `
                void fetchAll(in uint splatIndex, inout vec3 center, inout vec4 color, inout mat3 cov3d)
                {
                    // fetch motion, s, trbf
                    uvec4 texel = texelFetch(${other.name}, index2uv(splatIndex, ${other.texelPerSplat}u, 0u, textureSize(${other.name}, 0)), 0);
                    vec2 unpack16x2;
                    vec3 motion1, motion2, motion3, s;

                    unpack16x2 = uint2fp16x2(texel.x);
                    motion1.x = unpack16x2.x; motion1.y = unpack16x2.y;
                    unpack16x2 = uint2fp16x2(texel.y);
                    motion1.z = unpack16x2.x; motion2.x = unpack16x2.y;
                    unpack16x2 = uint2fp16x2(texel.z);
                    motion2.y = unpack16x2.x; motion2.z = unpack16x2.y;
                    unpack16x2 = uint2fp16x2(texel.w);
                    motion3.x = unpack16x2.x; motion3.y = unpack16x2.y;

                    texel = texelFetch(${other.name}, index2uv(splatIndex, ${other.texelPerSplat}u, 1u, textureSize(${other.name}, 0)), 0);
                    unpack16x2 = uint2fp16x2(texel.x);
                    motion3.z = unpack16x2.x; s.x = unpack16x2.y;
                    unpack16x2 = uint2fp16x2(texel.y);
                    s.y = unpack16x2.x; s.z = unpack16x2.y;

                    float deltaT = timestamp - uintBitsToFloat(texel.z);
                    float trbfScale = uintBitsToFloat(texel.w);

                    // fetch center, color
                    fetchCenterColor(splatIndex, center, color);
                    center += (motion1 + (motion2 + motion3 * deltaT) * deltaT) * deltaT;
                    color.a *= exp(-trbfScale * deltaT * deltaT);

                    // fetch rot
                    mat3 rot;
                    fetchRot(splatIndex, deltaT, rot);

                    // compute cov3d
                    mat3 ss = mat3(
                        s.x * s.x, 0.0, 0.0,
                        0.0, s.y * s.y, 0.0,
                        0.0, 0.0, s.z * s.z
                    );
                    cov3d = rot * ss * transpose(rot);
                }
            `
        }

        return res;
    }

    static getFetchParams(buffers) {
        let res = `
            fetchAll(splatIndex, splatCenter, splatColor, Vrk);
        `

        return res;
    }

    static getSpecificCode(buffers) {
        let res = ``;
        return res;
    }
}