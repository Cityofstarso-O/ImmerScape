import { GSType } from "../../Global.js";
import { GSKernel_3DGS } from "../../GSKernal/3dgs.js";
import { GSKernel_SPACETIME } from "../../GSKernal/spacetime.js";
import { Utils } from "../../Utils.js";

export class GlbLoader {
    static splitHeaderAndData(file) {
        const dataView = new DataView(file.data);

        const magic = dataView.getUint32(0, true);
        const version = dataView.getUint32(4, true);
        const length = dataView.getUint32(8, true);

        if (magic !== 0x46546C67) {
            throw new Error('invalid GLB file');
        }
        if (version !== 2) {
            throw new Error('glTF 2.0 supported only。');
        }

        let chunkOffset = 12;

        // 'JSON'
        const jsonChunkLength = dataView.getUint32(chunkOffset, true);
        const jsonChunkType = dataView.getUint32(chunkOffset + 4, true);
        if (jsonChunkType !== 0x4E4F534A) {
            throw new Error('json not found in glb file');
        }
        chunkOffset += 8
        const jsonChunkData = new Uint8Array(file.data, chunkOffset, jsonChunkLength);
        const jsonString = new TextDecoder('utf-8').decode(jsonChunkData);
        const json = JSON.parse(jsonString);
        file.json = json;
        
        chunkOffset += jsonChunkLength;

        // BIN
        if (chunkOffset < length) {
            const binaryChunkLength = dataView.getUint32(chunkOffset, true);
            const binaryChunkType = dataView.getUint32(chunkOffset + 4, true);
             if (binaryChunkType !== 0x004E4942) { // 'BIN'
                throw new Error('BIN chunk not found in glb file');
            }
            chunkOffset += 8;
            file.headerEnd = chunkOffset;
        }
    }

    static loadFromNative(file) {
        try {
            GlbLoader.splitHeaderAndData(file);
            const scene = GlbLoader.parseJson(file);
            GlbLoader.createSortBufferAndChunkBuffer(scene);

            return {
                valid: true,
                data: scene,
            };

        } catch (error) {
            return {
                valid: false,
                error: error.message,
            };
        }
    }

    static parseJson(file) {
        const json = file.json;
        const scene = {};
        scene.buffers = {};

        for (const image of json.images) {
            const bufferView = json.bufferViews[image.bufferView];
            const name = image.extras.name;
            const arrayBuffer = file.data;
            scene.buffers[name] = {...image.extras};
            const offset = bufferView.byteOffset + file.headerEnd;
            scene.buffers[name].offset = offset;
            scene.buffers[name].size = bufferView.byteLength;
            scene.buffers[name].buffer = arrayBuffer.slice(offset, offset + bufferView.byteLength);
        }

        scene.gsType = json.nodes[0].extras.gsType;
        scene.name = json.nodes[0].extras.name;
        scene.quality = json.nodes[0].extras.quality;
        scene.num = json.nodes[0].extras.num;

        scene.appliedScale = json.nodes[0].extras.appliedScale;
        scene.appliedTransform = json.nodes[0].matrix;
        scene.file = file;
        scene.chunkBased = 'chunkBased';
        scene.chunkNum = scene.num / 256;
        scene.chunkResolution = {
            width: scene.buffers.u_range.width,
            height: scene.buffers.u_range.height,
        }
        return scene;
    }

    static createSortBufferAndChunkBuffer(scene) {
        // splats may not fill the entire texture
        // so that the indices of valid splats are likely of incontiuity.
        // therefore we need all splats on texture
        const allSplatsOnTexture = scene.chunkResolution.width * scene.chunkResolution.height * 256;
        const sortBuffer = new Int32Array(allSplatsOnTexture * 4);
        const chunkBuffer = new Float32Array(scene.chunkNum * 6);
        const xyz = new Uint32Array(scene.buffers.u_xyz.buffer);
        const range = new DataView(scene.buffers.u_range.buffer);
        const chunkWidth = scene.buffers.u_xyz.width / 16, chunkHeight = scene.buffers.u_xyz.height / 16;
        const chunkNum = scene.chunkNum;
        const bit11Mask = 0x7FF;
        const bit10Mask = 0x3FF;
        // [chunkHeight, 16, chunkWidth, 16, 1]
        // note that: chunkNum <= chunkWidth * chunkHeight
        for (let i = 0; i < chunkNum; ++i) {
            const rangeOffset = i * 4 * 4;
            const xmin = Utils.readFp16(range, rangeOffset + 0, true);
            const ymin = Utils.readFp16(range, rangeOffset + 2, true);
            const zmin = Utils.readFp16(range, rangeOffset + 4, true);
            const xmax = Utils.readFp16(range, rangeOffset + 6, true);
            const ymax = Utils.readFp16(range, rangeOffset + 8, true);
            const zmax = Utils.readFp16(range, rangeOffset + 10, true);
            const chunk_w = i % chunkWidth;
            const chunk_h = Math.floor(i / chunkWidth);
            for (let local_h = 0; local_h < 16; ++local_h) {
                for (let local_w = 0; local_w < 16; ++local_w) {
                    const splatIndex = 1 * local_w + 16 * chunk_w + 16 * chunkWidth * local_h + 16 * chunkWidth * 16 * chunk_h;
                    const x11y10z11 = xyz[splatIndex];
                    const offset = splatIndex * 4;
                    if (offset >= sortBuffer.length) {
                        console.log('aaa', sortBuffer[offset])
                    }
                    sortBuffer[offset + 0] = Math.round(Utils.uintX2float(bit11Mask&(x11y10z11>> 0), 11, xmin, xmax) * 1000.0);
                    sortBuffer[offset + 1] = Math.round(Utils.uintX2float(bit10Mask&(x11y10z11>>11), 10, ymin, ymax) * 1000.0);
                    sortBuffer[offset + 2] = Math.round(Utils.uintX2float(bit11Mask&(x11y10z11>>21), 11, zmin, zmax) * 1000.0);
                }
            }

            const chunkOffset = 6 * i;
            chunkBuffer[chunkOffset + 0] = xmin;
            chunkBuffer[chunkOffset + 1] = ymin;
            chunkBuffer[chunkOffset + 2] = zmin;
            chunkBuffer[chunkOffset + 3] = xmax;
            chunkBuffer[chunkOffset + 4] = ymax;
            chunkBuffer[chunkOffset + 5] = zmax;
        }

        scene.sortBuffer = sortBuffer.buffer;
        scene.chunkBuffer = chunkBuffer.buffer;
    }
}