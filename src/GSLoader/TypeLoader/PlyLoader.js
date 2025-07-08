import { GSType } from "../../Global.js";
import { GSKernel_3DGS } from "../GSKernal/3dgs.js";

export class PlyLoader {
    static splitHeaderAndData(arrayBuffer) {
        const contentStart = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer, 0, 1600));
        const headerEnd = contentStart.indexOf('end_header') + 'end_header'.length + 1;
        const [header] = contentStart.split('end_header');
        const data = new DataView(arrayBuffer, headerEnd);
        return { header, data };
    }

    static loadFromNative(arrayBuffer) {
        const { header, data } = PlyLoader.splitHeaderAndData(arrayBuffer);
        const { offsets, pointCount } = PlyLoader.parseHeader(header);
        const gsType = PlyLoader.identifyGSType(offsets);
        let res;
        switch (gsType) {
            case GSType.ThreeD:
                res = GSKernel_3DGS.parseData2Buffers(pointCount, data);
                break;
            default:
                res = {
                    valid: false,
                    error: 'Unknown GSType',
                };
                break;
        };
        return res;
    }

    static parseHeader(text) {
        const lines = text.split('\n');
        const offsets = new Map();
        let offset = 0;
        let pointCount = 0;

        for (const line of lines) {
            if (line.trim() === "end_header") {
                break;
            }

            const words = line.split(/\s+/);
            const word = words[0];

            if (word === "property") {
                const type = words[1];
                const property = words[2];
                let size = 0;
                if (type === "float") {
                    size = 4;
                }
                offsets.set(property, offset);
                offset += size;
            } else if (word === "element") {
                const type = words[1];
                const count = parseInt(words[2], 10);

                if (type === "vertex") {
                    pointCount = count;
                }
            } else if (word === "format") {
                if (words[1] !== "binary_little_endian") {
                    throw new Error("ply file only supports binary_little_endian");
                }
            }
        }
        offsets.set("total", offset);
        return { offsets, pointCount };
    }

    static identifyGSType(offsets) {
        if (GSKernel_3DGS.identifyGSType(offsets)) {
            return GSType.ThreeD;
        } else {
            return GSType.NONE;
        }
    }

    updatePlyoffsets_3DGS(offsets) {
        this.ply_offsets[0] = (offsets.get("x") / 4)>>>0;
        this.ply_offsets[1] = (offsets.get("y") / 4)>>>0;
        this.ply_offsets[2] = (offsets.get("z") / 4)>>>0;
        this.ply_offsets[3] = (offsets.get("scale_0") / 4)>>>0;
        this.ply_offsets[4] = (offsets.get("scale_1") / 4)>>>0;
        this.ply_offsets[5] = (offsets.get("scale_2") / 4)>>>0;
        this.ply_offsets[6] = (offsets.get("rot_1") / 4)>>>0;
        this.ply_offsets[7] = (offsets.get("rot_2") / 4)>>>0;
        this.ply_offsets[8] = (offsets.get("rot_3") / 4)>>>0;
        this.ply_offsets[9] = (offsets.get("rot_0") / 4)>>>0;
        this.ply_offsets[10 + 0] = (offsets.get("f_dc_0") / 4)>>>0;
        this.ply_offsets[10 + 16] = (offsets.get("f_dc_1") / 4)>>>0;
        this.ply_offsets[10 + 32] = (offsets.get("f_dc_2") / 4)>>>0;
        for (let i = 0; i < 15; ++i) {
            this.ply_offsets[10 + 1 + i] =  (offsets.get("f_rest_" + (i)) / 4)>>>0;
            this.ply_offsets[10 + 17 + i] = (offsets.get("f_rest_" + (15 + i)) / 4)>>>0;
            this.ply_offsets[10 + 33 + i] = (offsets.get("f_rest_" + (30 + i)) / 4)>>>0;
        }
        this.ply_offsets[58] = (offsets.get("opacity") / 4)>>>0;
        this.ply_offsets[59] = (this.offset / 4)>>>0;
    }

    updatePlyoffsets_SpaceTime_LITE(offsets) {
        this.ply_offsets[0] = (offsets.get("x") / 4)>>>0;
        this.ply_offsets[1] = (offsets.get("y") / 4)>>>0;
        this.ply_offsets[2] = (offsets.get("z") / 4)>>>0;
        this.ply_offsets[3] = (offsets.get("scale_0") / 4)>>>0;
        this.ply_offsets[4] = (offsets.get("scale_1") / 4)>>>0;
        this.ply_offsets[5] = (offsets.get("scale_2") / 4)>>>0;
        this.ply_offsets[6] = (offsets.get("rot_1") / 4)>>>0;
        this.ply_offsets[7] = (offsets.get("rot_2") / 4)>>>0;
        this.ply_offsets[8] = (offsets.get("rot_3") / 4)>>>0;
        this.ply_offsets[9] = (offsets.get("rot_0") / 4)>>>0;
        this.ply_offsets[10] = (offsets.get("f_dc_0") / 4)>>>0;
        this.ply_offsets[11] = (offsets.get("f_dc_1") / 4)>>>0;
        this.ply_offsets[12] = (offsets.get("f_dc_2") / 4)>>>0;
        this.ply_offsets[13] = (offsets.get("opacity") / 4)>>>0;
        this.ply_offsets[14] = (offsets.get("trbf_center") / 4)>>>0;
        this.ply_offsets[15] = (offsets.get("trbf_scale") / 4)>>>0;
        for (let i=0;i<9;i+=1) {
            this.ply_offsets[16 + i] = (offsets.get("motion_" + (i)) / 4)>>>0;
        }
        for (let i=0;i<4;i+=1) {
            this.ply_offsets[25 + i] = (offsets.get("omega_" + (i)) / 4)>>>0;
        }
        this.ply_offsets[59] = (this.offset / 4)>>>0;
    }
}