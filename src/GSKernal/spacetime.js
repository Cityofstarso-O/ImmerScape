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
    static rotRange = [-1.0, 1.3];
    static omegaRange = [-0.17, 0.17];
    static motionRange = [-5.0, 5.0];
    static tcRange = [-0.05, 1.05];
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
    static config = {
        low: {
            pospad: {
                name: 'Pos6Pad2',
                bytesPerTexel: 3 * 2 + 2,
                texelPerSplat: 1,
                format: "RGBA16F",
                array: 1,
            },
            rot: {
                name: 'Rot4Omega4Scale6Ts2',
                bytesPerTexel: 4 + 4 + 6 + 2,
                texelPerSplat: 1,
                format: "RGBA32UI",
                array: 1,
            },
            other: {
                name: 'Motion11Tc1Col4',
                bytesPerTexel: 16,
                texelPerSplat: 1,
                format: "RGBA32UI",
                array: 1,
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
            rot: {
                name: 'Rot8Omega4Col4',
                bytesPerTexel: 8 + 4 + 4,
                texelPerSplat: 1,
                format: "RGBA32UI",
                array: 1,
            },
            other: {
                name: 'Motion15Tc1Scale6Ts2',
                bytesPerTexel: 12,
                texelPerSplat: 2,
                format: "RGB32UI",
                array: 1,
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
            rot: {
                name: 'Rot8Omega8',
                bytesPerTexel: 2 * 4 * 2,
                texelPerSplat: 1,
                format: "RGBA32UI",
                array: 1,
            },
            other: {
                name: 'Motion18Scale6Tc2Ts2Col4',
                bytesPerTexel: 16,
                texelPerSplat: 2,
                format: "RGBA32UI",
                array: 1,
            },
        },
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

    static parsePlyData2Buffers = function() {

        return function(pointCount, dataview, quality = 'medium') {
            // a little hack, pointCount shouldn't be too large (<= 8,388,608)
            if (pointCount > 4096 * 2048) {
                console.warn(`pointCount ${pointCount} is too large and is clamped to 8,388,608`);
                pointCount = 4096 * 2048;
            }

            let currentConfig = GSKernel_SPACETIME.config[quality] || config.low;
            const pospad = {...currentConfig.pospad};
            const rot = {...currentConfig.rot};
            const other = {...currentConfig.other};

            Object.assign(pospad, Utils.computeTexSize(pospad.texelPerSplat * pointCount));
            Object.assign(rot, Utils.computeTexSize(rot.texelPerSplat * pointCount));
            Object.assign(other, Utils.computeTexSize(other.texelPerSplat * pointCount));

            pospad.buffer = new ArrayBuffer(pospad.width * pospad.height * pospad.bytesPerTexel);
            rot.buffer = new ArrayBuffer(rot.width * rot.height * rot.bytesPerTexel);
            other.buffer = new ArrayBuffer(other.width * other.height * other.bytesPerTexel);
            const sortBuffer = new Float32Array(pointCount * 13);

            const pospadView = new DataView(pospad.buffer);
            const rotView = new DataView(rot.buffer);
            const otherView = new DataView(other.buffer);
            const splat = {...GSKernel_SPACETIME.params};
            let pospadOffset = 0, rotOffset = 0, otherOffset = 0, sortOffset = 0;
            const self = GSKernel_SPACETIME;
            if (quality == 'high') {
                for (let i = 0;i < pointCount; ++i) {
                    GSKernel_SPACETIME.parseSplatFromData(i, splat, dataview);
                    pospadView.setFloat32(pospadOffset + 0, splat.x, true);
                    pospadView.setFloat32(pospadOffset + 4, splat.y, true);
                    pospadView.setFloat32(pospadOffset + 8, splat.z, true);
                    
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
                    otherView.setUint16(otherOffset + 18, Utils.f2fp162uint16(splat.tc), true);
                    otherView.setUint16(otherOffset + 20, Utils.f2fp162uint16(splat.sx), true);
                    otherView.setUint16(otherOffset + 22, Utils.f2fp162uint16(splat.sy), true);
                    otherView.setUint16(otherOffset + 24, Utils.f2fp162uint16(splat.sz), true);
                    otherView.setUint16(otherOffset + 26, Utils.f2fp162uint16(splat.ts), true);
                    Utils.packFloat2rgba(
                        splat.cr, splat.cg, splat.cb, splat.ca,
                        otherView, otherOffset + 28
                    );

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

                    pospadOffset += pospad.bytesPerTexel * pospad.texelPerSplat;
                    rotOffset += rot.bytesPerTexel * rot.texelPerSplat;
                    otherOffset += other.bytesPerTexel * other.texelPerSplat;
                    sortOffset += 13;
                }
            } else if (quality == 'medium') {
                for (let i = 0;i < pointCount; ++i) {
                    GSKernel_SPACETIME.parseSplatFromData(i, splat, dataview);
                    pospadView.setUint16(pospadOffset + 0, Utils.f2fp162uint16(splat.x), true);
                    pospadView.setUint16(pospadOffset + 2, Utils.f2fp162uint16(splat.y), true);
                    pospadView.setUint16(pospadOffset + 4, Utils.f2fp162uint16(splat.z), true);

                    rotView.setUint16(rotOffset +  0, Utils.f2fp162uint16(splat.rx), true);
                    rotView.setUint16(rotOffset +  2, Utils.f2fp162uint16(splat.ry), true);
                    rotView.setUint16(rotOffset +  4, Utils.f2fp162uint16(splat.rz), true);
                    rotView.setUint16(rotOffset +  6, Utils.f2fp162uint16(splat.rw), true);
                    Utils.pack4Float2Uint32(
                        splat.rot1x, splat.rot1y, splat.rot1z, splat.rot1w,
                        self.omegaRange[0], self.omegaRange[1],
                        rotView, rotOffset + 8
                    );
                    Utils.packFloat2rgba(
                        splat.cr, splat.cg, splat.cb, splat.ca,
                        rotView, rotOffset + 12
                    );
                    
                    otherView.setUint16(otherOffset +  0, Utils.f2fp162uint16(splat.pos1x), true);
                    otherView.setUint16(otherOffset +  2, Utils.f2fp162uint16(splat.pos1y), true);
                    otherView.setUint16(otherOffset +  4, Utils.f2fp162uint16(splat.pos1z), true);
                    otherView.setUint16(otherOffset +  6, Utils.f2fp162uint16(splat.pos2x), true);
                    otherView.setUint16(otherOffset +  8, Utils.f2fp162uint16(splat.pos2y), true);
                    otherView.setUint16(otherOffset + 10, Utils.f2fp162uint16(splat.pos2z), true);
                    Utils.pack4Float2Uint32(
                        splat.pos3x, splat.pos3y, splat.pos3z, splat.tc,
                        [self.motionRange[0], self.motionRange[0], self.motionRange[0], self.tcRange[0]],
                        [self.motionRange[1], self.motionRange[1], self.motionRange[1], self.tcRange[1]],
                        otherView, otherOffset + 12
                    );
                    otherView.setUint16(otherOffset + 16, Utils.f2fp162uint16(splat.sx), true);
                    otherView.setUint16(otherOffset + 18, Utils.f2fp162uint16(splat.sy), true);
                    otherView.setUint16(otherOffset + 20, Utils.f2fp162uint16(splat.sz), true);
                    otherView.setUint16(otherOffset + 22, Utils.f2fp162uint16(splat.ts), true);

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

                    pospadOffset += pospad.bytesPerTexel * pospad.texelPerSplat;
                    rotOffset += rot.bytesPerTexel * rot.texelPerSplat;
                    otherOffset += other.bytesPerTexel * other.texelPerSplat;
                    sortOffset += 13;
                }
            } else if (quality == 'low') {
                for (let i = 0;i < pointCount; ++i) {
                    GSKernel_SPACETIME.parseSplatFromData(i, splat, dataview);
                    pospadView.setUint16(pospadOffset + 0, Utils.f2fp162uint16(splat.x), true);
                    pospadView.setUint16(pospadOffset + 2, Utils.f2fp162uint16(splat.y), true);
                    pospadView.setUint16(pospadOffset + 4, Utils.f2fp162uint16(splat.z), true);

                    Utils.pack4Float2Uint32(
                        splat.rx, splat.ry, splat.rz, splat.rw,
                        self.rotRange[0], self.rotRange[1],
                        rotView, rotOffset + 0
                    );
                    Utils.pack4Float2Uint32(
                        splat.rot1x, splat.rot1y, splat.rot1z, splat.rot1w,
                        self.omegaRange[0], self.omegaRange[1],
                        rotView, rotOffset + 4
                    );
                    rotView.setUint16(rotOffset + 8, Utils.f2fp162uint16(splat.sx), true);
                    rotView.setUint16(rotOffset + 10, Utils.f2fp162uint16(splat.sy), true);
                    rotView.setUint16(rotOffset + 12, Utils.f2fp162uint16(splat.sz), true);
                    rotView.setUint16(rotOffset + 14, Utils.f2fp162uint16(splat.ts), true);
                    
                    Utils.pack4Float2Uint32(
                        splat.pos1x, splat.pos1y, splat.pos1z, 0,
                        self.motionRange[0], self.motionRange[1],
                        otherView, otherOffset + 0
                    );
                    Utils.pack4Float2Uint32(
                        splat.pos2x, splat.pos2y, splat.pos2z, 0,
                        self.motionRange[0], self.motionRange[1],
                        otherView, otherOffset + 4
                    );
                    Utils.pack4Float2Uint32(
                        splat.pos3x, splat.pos3y, splat.pos3z, splat.tc,
                        [self.motionRange[0], self.motionRange[0], self.motionRange[0], self.tcRange[0]],
                        [self.motionRange[1], self.motionRange[1], self.motionRange[1], self.tcRange[1]],
                        otherView, otherOffset + 8
                    );
                    Utils.packFloat2rgba(
                        splat.cr, splat.cg, splat.cb, splat.ca,
                        otherView, otherOffset + 12
                    );

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

                    pospadOffset += pospad.bytesPerTexel * pospad.texelPerSplat;
                    rotOffset += rot.bytesPerTexel * rot.texelPerSplat;
                    otherOffset += other.bytesPerTexel * other.texelPerSplat;
                    sortOffset += 13;
                }
            }

            const buffers = { pospad, rot, other };

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

    static parseSpbData2Buffers(descriptor, arrayBuffer) {
        const self = GSKernel_SPACETIME;
        const quality = descriptor.quality;
        const pointCount = descriptor.num;
        const buffers = {...GSKernel_SPACETIME.config[quality]};
        const pospad = buffers.pospad;
        const rot = buffers.rot;
        const other = buffers.other;

        Object.assign(pospad, Utils.computeTexSize(pospad.texelPerSplat * pointCount));
        Object.assign(rot, Utils.computeTexSize(rot.texelPerSplat * pointCount));
        Object.assign(other, Utils.computeTexSize(other.texelPerSplat * pointCount));

        pospad.buffer = arrayBuffer.slice(descriptor.buffers.bind0.offset, 
            descriptor.buffers.bind0.offset + pospad.width * pospad.height * pospad.bytesPerTexel);
        rot.buffer = arrayBuffer.slice(descriptor.buffers.bind1.offset, 
            descriptor.buffers.bind1.offset + rot.width * rot.height * rot.bytesPerTexel);
        if (descriptor.pad) {
            other.buffer = arrayBuffer.slice(descriptor.buffers.bind2.offset, 
                descriptor.buffers.bind2.offset + other.width * other.height * other.bytesPerTexel);
        } else {
            other.buffer = new ArrayBuffer(other.width * other.height * other.bytesPerTexel);
            new Uint8Array(other.buffer).set(new Uint8Array(arrayBuffer, descriptor.buffers.bind2.offset));
        }

        const sortBuffer = new Float32Array(pointCount * 13);
        const pospadView = new DataView(pospad.buffer);
        const otherView = new DataView(other.buffer);
        let sortOffset = 0, pospadOffset = 0, otherOffset = 0;
        if (quality == 'high') {
            for (let i = 0;i < pointCount; ++i) {
                sortBuffer[sortOffset +  0] = pospadView.getFloat32(pospadOffset + 0, true);
                sortBuffer[sortOffset +  1] = otherView.getFloat16(otherOffset + 0, true);
                sortBuffer[sortOffset +  2] = otherView.getFloat16(otherOffset + 6, true);
                sortBuffer[sortOffset +  3] = otherView.getFloat16(otherOffset + 12, true);
                sortBuffer[sortOffset +  4] = pospadView.getFloat32(pospadOffset + 4, true);
                sortBuffer[sortOffset +  5] = otherView.getFloat16(otherOffset + 2, true);
                sortBuffer[sortOffset +  6] = otherView.getFloat16(otherOffset + 8, true);
                sortBuffer[sortOffset +  7] = otherView.getFloat16(otherOffset + 14, true);
                sortBuffer[sortOffset +  8] = pospadView.getFloat32(pospadOffset + 8, true);
                sortBuffer[sortOffset +  9] = otherView.getFloat16(otherOffset + 4, true);
                sortBuffer[sortOffset + 10] = otherView.getFloat16(otherOffset + 10, true);
                sortBuffer[sortOffset + 11] = otherView.getFloat16(otherOffset + 16, true);
                sortBuffer[sortOffset + 12] = otherView.getFloat16(otherOffset + 18, true);
                pospadOffset += pospad.bytesPerTexel * pospad.texelPerSplat;
                otherOffset += other.bytesPerTexel * other.texelPerSplat;
                sortOffset += 13;
            }
        } else if (quality == 'medium') {
            for (let i = 0;i < pointCount; ++i) {
                sortBuffer[sortOffset +  0] = pospadView.getFloat16(pospadOffset + 0, true);
                sortBuffer[sortOffset +  1] = otherView.getFloat16(otherOffset + 0, true);
                sortBuffer[sortOffset +  2] = otherView.getFloat16(otherOffset + 6, true);
                sortBuffer[sortOffset +  3] = Utils.uint82float(otherView.getUint8(otherOffset + 12), self.motionRange[0], self.motionRange[1]);
                sortBuffer[sortOffset +  4] = pospadView.getFloat16(pospadOffset + 2, true);
                sortBuffer[sortOffset +  5] = otherView.getFloat16(otherOffset + 2, true);
                sortBuffer[sortOffset +  6] = otherView.getFloat16(otherOffset + 8, true);
                sortBuffer[sortOffset +  7] = Utils.uint82float(otherView.getUint8(otherOffset + 13), self.motionRange[0], self.motionRange[1]);
                sortBuffer[sortOffset +  8] = pospadView.getFloat16(pospadOffset + 4, true);
                sortBuffer[sortOffset +  9] = otherView.getFloat16(otherOffset + 4, true);
                sortBuffer[sortOffset + 10] = otherView.getFloat16(otherOffset + 10, true);
                sortBuffer[sortOffset + 11] = Utils.uint82float(otherView.getUint8(otherOffset + 14), self.motionRange[0], self.motionRange[1]);
                sortBuffer[sortOffset + 12] = Utils.uint82float(otherView.getUint8(otherOffset + 15), self.tcRange[0], self.tcRange[1]);
                pospadOffset += pospad.bytesPerTexel * pospad.texelPerSplat;
                otherOffset += other.bytesPerTexel * other.texelPerSplat;
                sortOffset += 13;
            }
        } else if (quality == 'low') {
            for (let i = 0;i < pointCount; ++i) {
                sortBuffer[sortOffset +  0] = pospadView.getFloat16(pospadOffset + 0, true);
                sortBuffer[sortOffset +  1] = Utils.uint82float(otherView.getUint8(otherOffset + 0), self.motionRange[0], self.motionRange[1]);
                sortBuffer[sortOffset +  2] = Utils.uint82float(otherView.getUint8(otherOffset + 4), self.motionRange[0], self.motionRange[1]);
                sortBuffer[sortOffset +  3] = Utils.uint82float(otherView.getUint8(otherOffset + 8), self.motionRange[0], self.motionRange[1]);
                sortBuffer[sortOffset +  4] = pospadView.getFloat16(pospadOffset + 2, true);
                sortBuffer[sortOffset +  5] = Utils.uint82float(otherView.getUint8(otherOffset + 1), self.motionRange[0], self.motionRange[1]);
                sortBuffer[sortOffset +  6] = Utils.uint82float(otherView.getUint8(otherOffset + 5), self.motionRange[0], self.motionRange[1]);
                sortBuffer[sortOffset +  7] = Utils.uint82float(otherView.getUint8(otherOffset + 9), self.motionRange[0], self.motionRange[1]);
                sortBuffer[sortOffset +  8] = pospadView.getFloat16(pospadOffset + 4, true);
                sortBuffer[sortOffset +  9] = Utils.uint82float(otherView.getUint8(otherOffset + 2), self.motionRange[0], self.motionRange[1]);
                sortBuffer[sortOffset + 10] = Utils.uint82float(otherView.getUint8(otherOffset + 6), self.motionRange[0], self.motionRange[1]);
                sortBuffer[sortOffset + 11] = Utils.uint82float(otherView.getUint8(otherOffset + 10), self.motionRange[0], self.motionRange[1]);
                sortBuffer[sortOffset + 12] = Utils.uint82float(otherView.getUint8(otherOffset + 11), self.tcRange[0], self.tcRange[1]);
                pospadOffset += pospad.bytesPerTexel * pospad.texelPerSplat;
                otherOffset += other.bytesPerTexel * other.texelPerSplat;
                sortOffset += 13;
            }
        }

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

    static getUniformDefines() {
        return `
            // spacetime specific uniforms
            uniform float timestamp;
        `;
    }

    static getFetchFunc(buffers) {
        const self = GSKernel_SPACETIME;
        let res = ``;
        const pospad = buffers.pospad;
        res += `
            void fetchCenter(in uint splatIndex, inout vec3 center)
            {
                vec4 texel = texelFetch(${pospad.name}, index2uv(splatIndex, ${pospad.texelPerSplat}u, 0u, textureSize(${pospad.name}, 0)), 0);
                center = texel.xyz;
            }
        `;

        const rot = buffers.rot;
        if (rot.name == "Rot8Omega8") {
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
        } else if (rot.name == "Rot8Omega4Col4") {
            res += `
                void fetchRotColor(in uint splatIndex, in float deltaT, inout mat3 rot, inout vec4 color)
                {
                    uvec4 texel = texelFetch(${rot.name}, index2uv(splatIndex, ${rot.texelPerSplat}u, 0u, textureSize(${rot.name}, 0)), 0);
                    vec2 unpack16x2;
                    vec4 q;
                    unpack16x2 = uint2fp16x2(texel.x);
                    q.x = unpack16x2.x; q.y = unpack16x2.y;
                    unpack16x2 = uint2fp16x2(texel.y);
                    q.z = unpack16x2.x; q.w = unpack16x2.y;
                    vec4 omega = uint2vec4(texel.z, vec4(${self.omegaRange[0].toFixed(5)}), vec4(${self.omegaRange[1].toFixed(5)}));
                    color = uint2rgba(texel.w);

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
        } else if (rot.name == 'Rot4Omega4Scale6Ts2') {
            res += `
                void fetchCov3dTs(in uint splatIndex, in float deltaT, inout mat3 cov3d, inout float ts)
                {
                    uvec4 texel = texelFetch(${rot.name}, index2uv(splatIndex, ${rot.texelPerSplat}u, 0u, textureSize(${rot.name}, 0)), 0);
                    vec4 q = uint2vec4(texel.x, vec4(${self.rotRange[0].toFixed(5)}), vec4(${self.rotRange[1].toFixed(5)}));
                    vec4 omega = uint2vec4(texel.y, vec4(${self.omegaRange[0].toFixed(5)}), vec4(${self.omegaRange[1].toFixed(5)}));
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
                    mat3 rot = mat3(
                        1.0 - 2.0 * (yy + zz), 2.0 * (xy + wz), 2.0 * (xz - wy),
                        2.0 * (xy - wz), 1.0 - 2.0 * (xx + zz), 2.0 * (yz + wx),
                        2.0 * (xz + wy), 2.0 * (yz - wx), 1.0 - 2.0 * (xx + yy)
                    );

                    vec2 unpack16x2;
                    vec3 s;
                    unpack16x2 = uint2fp16x2(texel.z);
                    s.x = unpack16x2.x; s.y = unpack16x2.y;
                    unpack16x2 = uint2fp16x2(texel.w);
                    s.z = unpack16x2.x; ts = unpack16x2.y;

                    mat3 ss = mat3(
                        s.x * s.x, 0.0, 0.0,
                        0.0, s.y * s.y, 0.0,
                        0.0, 0.0, s.z * s.z
                    );
                    cov3d = rot * ss * transpose(rot);
                }
            `
        }
        const other = buffers.other;
        const mMin = self.motionRange[0].toFixed(5);
        const mMax = self.motionRange[1].toFixed(5);
        const tMin = self.tcRange[0].toFixed(5);
        const tMax = self.tcRange[1].toFixed(5);
        if (other.name == "Motion18Scale6Tc2Ts2Col4") {
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
                    motion3.z = unpack16x2.x;
                    float deltaT = timestamp - unpack16x2.y;
                    unpack16x2 = uint2fp16x2(texel.y);
                    s.x = unpack16x2.x; s.y = unpack16x2.y;
                    unpack16x2 = uint2fp16x2(texel.z);
                    s.z = unpack16x2.x;
                    float trbfScale = unpack16x2.y;
                    color = uint2rgba(texel.w);

                    // fetch center, color
                    fetchCenter(splatIndex, center);
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
        } else if (other.name == "Motion15Tc1Scale6Ts2") {
            res += `
                void fetchAll(in uint splatIndex, inout vec3 center, inout vec4 color, inout mat3 cov3d)
                {
                    // fetch motion, s, trbf
                    uvec4 texel = texelFetch(${other.name}, index2uv(splatIndex, ${other.texelPerSplat}u, 0u, textureSize(${other.name}, 0)), 0);
                    vec2 unpack16x2;
                    vec3 motion1, motion2, s;
                    vec4 motion3_tc;

                    unpack16x2 = uint2fp16x2(texel.x);
                    motion1.x = unpack16x2.x; motion1.y = unpack16x2.y;
                    unpack16x2 = uint2fp16x2(texel.y);
                    motion1.z = unpack16x2.x; motion2.x = unpack16x2.y;
                    unpack16x2 = uint2fp16x2(texel.z);
                    motion2.y = unpack16x2.x; motion2.z = unpack16x2.y;

                    texel = texelFetch(${other.name}, index2uv(splatIndex, ${other.texelPerSplat}u, 1u, textureSize(${other.name}, 0)), 0);
                    motion3_tc = uint2vec4(texel.x, vec4(${mMin}, ${mMin}, ${mMin}, ${tMin}), vec4(${mMax}, ${mMax}, ${mMax}, ${tMax}));
                    unpack16x2 = uint2fp16x2(texel.y);
                    s.x = unpack16x2.x; s.y = unpack16x2.y;
                    unpack16x2 = uint2fp16x2(texel.z);
                    s.z = unpack16x2.x;
                    float deltaT = timestamp - motion3_tc.w;
                    float trbfScale = unpack16x2.y;

                    // fetch center
                    fetchCenter(splatIndex, center);
                    center += (motion1 + (motion2 + motion3_tc.xyz * deltaT) * deltaT) * deltaT;

                    // fetch rot, color
                    mat3 rot;
                    fetchRotColor(splatIndex, deltaT, rot, color);
                    color.a *= exp(-trbfScale * deltaT * deltaT);

                    // compute cov3d
                    mat3 ss = mat3(
                        s.x * s.x, 0.0, 0.0,
                        0.0, s.y * s.y, 0.0,
                        0.0, 0.0, s.z * s.z
                    );
                    cov3d = rot * ss * transpose(rot);
                }
            `
        } else if (other.name == 'Motion11Tc1Col4') {
            res += `
                void fetchAll(in uint splatIndex, inout vec3 center, inout vec4 color, inout mat3 cov3d)
                {
                    // fetch motion, tc, color
                    uvec4 texel = texelFetch(${other.name}, index2uv(splatIndex, ${other.texelPerSplat}u, 0u, textureSize(${other.name}, 0)), 0);
                    vec3 motion1, motion2;
                    vec4 motion3_tc;

                    motion1 = uint2vec4(texel.x, vec4(${mMin}), vec4(${mMax})).xyz;
                    motion2 = uint2vec4(texel.y, vec4(${mMin}), vec4(${mMax})).xyz;
                    motion3_tc = uint2vec4(texel.z, vec4(${mMin}, ${mMin}, ${mMin}, ${tMin}), vec4(${mMax}, ${mMax}, ${mMax}, ${tMax}));
                    color = uint2rgba(texel.w);

                    float deltaT = timestamp - motion3_tc.w;

                    // fetch center
                    fetchCenter(splatIndex, center);
                    center += (motion1 + (motion2 + motion3_tc.xyz * deltaT) * deltaT) * deltaT;

                    // fetch vrk, ts
                    float trbfScale;
                    fetchCov3dTs(splatIndex, deltaT, cov3d, trbfScale);
                    color.a *= exp(-trbfScale * deltaT * deltaT);
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