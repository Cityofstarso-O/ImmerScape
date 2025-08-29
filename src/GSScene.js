import { Utils } from "./Utils.js";
import * as THREE from "three"

export class GSScene {
    constructor(options, eventBus, graphicsAPI) {
        this.eventBus = eventBus;
        this.eventBus.on('buffersReady', this.onBuffersReady.bind(this));
        this.scenes = {};
        this.graphicsAPI = graphicsAPI;

        // state
        this.currentUID = '';
        this.ready = false;
    }

    getCurrentScene(property) {
        return this.scenes[this.currentUID][property];
    }

    async onBuffersReady({ data, sceneName }) {
        this.ready = false;
        const uid = data.uid;
        this.scenes[uid] = data;
        this.setupTex(uid);

        // set state: new scene is ready
        this.currentUID = uid;
        this.ready = true;
    }

    setupTex(sceneName) {
        let bindIndex = 0;
        Object.values(this.scenes[sceneName].buffers).forEach(value => {
            value.bind = value.bind || bindIndex;
            this.graphicsAPI.setupTexture(value);
            value.buffer = null;
            ++bindIndex;
        });
        console.log(this.scenes[sceneName])
    }

    async destoryOldScene(oldScene) {
        if (oldScene) {
            const scene = this.scenes[oldScene];
            Object.values(scene.buffers).forEach(value => {
                this.graphicsAPI.deleteTexture(value.texture);
                value.buffer = null;
                value.texture = null;
            });
            scene.file.data = null;

            delete this.scenes[oldScene];
        }
        console.log('dstory', this.scenes)
    }

    removeScene(uid) {
        if (uid === this.currentUID) {
            this.ready = false;
        }
        this.destoryOldScene(uid);
    }

    switchToScene(uid) {
        this.eventBus.emit('buffersReady', {
            data: this.scenes[uid],
            sceneName: this.scenes[uid].name,
        })
    }

    updateTransform = function() {
        const tmpMat = new THREE.Matrix4();
        const euler = new THREE.Euler(0, 0, 0, 'ZXY');
        const deg2rad = Math.PI / 180;
        return function() {
            const transform = this.scenes[this.currentUID].transform;
            euler.set(transform.rotation.x * deg2rad, transform.rotation.y * deg2rad, transform.rotation.z * deg2rad);
            tmpMat.makeRotationFromEuler(euler);
            tmpMat.setPosition(transform.position.x, transform.position.y, transform.position.z);

            const modelMatrix = this.scenes[this.currentUID].modelMatrix;
            modelMatrix.copy(this.scenes[this.currentUID].appliedTransform);
            modelMatrix.premultiply(tmpMat);

            this.scenes[this.currentUID].sceneScale = this.scenes[this.currentUID].appliedScale * transform.scale.x;
        }
    }();

    applyTransform() {
        this.scenes[this.currentUID].appliedTransform.copy(this.scenes[this.currentUID].modelMatrix);
        this.scenes[this.currentUID].appliedScale = this.scenes[this.currentUID].sceneScale;

        const transform = this.scenes[this.currentUID].transform;
        transform.position.x = 0;
        transform.position.y = 0;
        transform.position.z = 0;
        transform.rotation.x = 0;
        transform.rotation.y = 0;
        transform.rotation.z = 0;
        transform.scale.x = 1;
        transform.scale.y = 1;
        transform.scale.z = 1;
    }

    resetTransform() {
        this.scenes[this.currentUID].appliedTransform.fromArray(this.scenes[this.currentUID].file.json.nodes[0].matrix);
        this.scenes[this.currentUID].appliedScale = this.scenes[this.currentUID].file.json.nodes[0].extras.appliedScale;
        this.scenes[this.currentUID].modelMatrix.copy(this.scenes[this.currentUID].appliedTransform);
        this.scenes[this.currentUID].sceneScale = this.scenes[this.currentUID].appliedScale;

        const transform = this.scenes[this.currentUID].transform;
        transform.position.x = 0;
        transform.position.y = 0;
        transform.position.z = 0;
        transform.rotation.x = 0;
        transform.rotation.y = 0;
        transform.rotation.z = 0;
        transform.scale.x = 1;
        transform.scale.y = 1;
        transform.scale.z = 1;
    }

    forceSort() {
        if (this.ready && this.currentUID) {
            return this.scenes[this.currentUID].gsType === 'SPACETIME';
        }
        return false;
    }

    getSplatNum() {
        if (this.currentUID && this.scenes[this.currentUID]) {
            return this.scenes[this.currentUID].num;
        }
        return 0;
    }

    getBuffers() {
        return this.scenes[this.currentUID].buffers;
    }

    static debugUnpackBuffer(buffers, idx = 0) {
        const pospad = new DataView(buffers.pospad.buffer, buffers.pospad.bytesPerTexel * idx);
        console.log('pos', pospad.getFloat32(0, true), pospad.getFloat32(4, true), pospad.getFloat32(8, true))
        const covcol = new DataView(buffers.covcol.buffer, buffers.covcol.bytesPerTexel * idx);
        console.log('cov', Utils.uint162fp162f(covcol.getUint16(0, true)),
            Utils.uint162fp162f(covcol.getUint16(2, true)),
            Utils.uint162fp162f(covcol.getUint16(4, true)),
            Utils.uint162fp162f(covcol.getUint16(6, true)),
            Utils.uint162fp162f(covcol.getUint16(8, true)),
            Utils.uint162fp162f(covcol.getUint16(10, true))
        )
        console.log('col', 
            Utils.uint82float(covcol.getUint8(12, true)),
            Utils.uint82float(covcol.getUint8(13, true)),
            Utils.uint82float(covcol.getUint8(14, true)),
            Utils.uint82float(covcol.getUint8(15, true))
        )
    }

    modifyGlbJson() {
        const scene = this.scenes[this.currentUID];
        const originalGlbBuffer = scene.file.data;

        const dataView = new DataView(originalGlbBuffer);
        const textDecoder = new TextDecoder('utf-8');
        const textEncoder = new TextEncoder();

        // --- 步骤 1: 解析头部和旧的 JSON 块 ---

        // 检查 "glTF" 魔术字
        const magic = dataView.getUint32(0, true);
        if (magic !== 0x46546C67) {
            console.error("提供的文件不是有效的 GLB 文件。");
            return originalGlbBuffer;
        }

        const version = dataView.getUint32(4, true);
        const fileLength = dataView.getUint32(8, true);

        // 第一个块总是 JSON 块
        let byteOffset = 12;
        const jsonChunkLength = dataView.getUint32(byteOffset, true);
        byteOffset += 4;
        const jsonChunkType = dataView.getUint32(byteOffset, true);
        byteOffset += 4;

        if (jsonChunkType !== 0x4E4F534A) { // 'JSON'
            console.error("找不到 GLB 的 JSON 块。");
            return originalGlbBuffer;
        }

        const jsonChunkData = new Uint8Array(originalGlbBuffer, byteOffset, jsonChunkLength);
        // 计算旧 JSON 块对齐后的长度，以便找到 BIN 块的起始位置
        const oldPaddedJsonLength = (jsonChunkLength + 3) & ~3; 

        // --- 步骤 2: 解码并修改 JSON 对象 ---

        const jsonString = textDecoder.decode(jsonChunkData);
        let json = JSON.parse(jsonString);

        // 调用用户提供的函数来修改 JSON
        json.nodes[0].matrix = scene.modelMatrix.toArray();
        json.nodes[0].extras.appliedScale = scene.sceneScale;

        // --- 步骤 3: 重新编码新的 JSON 数据 ---

        const newJsonString = JSON.stringify(json);
        const newJsonChunkData = textEncoder.encode(newJsonString);
        const newJsonChunkLength = newJsonChunkData.length;

        // GLB 块必须是4字节对齐的。计算需要填充的空格数。
        const padding = (4 - (newJsonChunkLength % 4)) % 4;
        const newPaddedJsonLength = newJsonChunkLength + padding;

        // 创建一个包含新 JSON 数据和填充的 Uint8Array
        const paddedNewJsonData = new Uint8Array(newPaddedJsonLength);
        paddedNewJsonData.set(newJsonChunkData);
        // 用空格（0x20）填充
        for (let i = 0; i < padding; i++) {
            paddedNewJsonData[newJsonChunkLength + i] = 0x20;
        }

        // --- 步骤 4: 计算新文件总长度 ---

        const originalBinChunkAndHeader = originalGlbBuffer.slice(12 + 8 + oldPaddedJsonLength);
        const newFileLength = 12 + 8 + newPaddedJsonLength + originalBinChunkAndHeader.byteLength;

        // --- 步骤 5: 重新组装新的 GLB 文件 ---

        const newGlbBuffer = new ArrayBuffer(newFileLength);
        const newGlbData = new Uint8Array(newGlbBuffer);
        const newGlbDataView = new DataView(newGlbBuffer);

        // 写入新的 GLB 头部
        newGlbData.set(new Uint8Array(originalGlbBuffer, 0, 12)); // 复制旧头部
        newGlbDataView.setUint32(8, newFileLength, true); // 更新总长度

        // 写入新的 JSON 块
        let newByteOffset = 12;
        newGlbDataView.setUint32(newByteOffset, newPaddedJsonLength, true); // 新的 JSON 长度
        newByteOffset += 4;
        newGlbDataView.setUint32(newByteOffset, 0x4E4F534A, true); // 'JSON' 类型
        newByteOffset += 4;
        newGlbData.set(paddedNewJsonData, newByteOffset); // 新的、已填充的 JSON 数据
        newByteOffset += newPaddedJsonLength;

        // 写入原始的 BIN 块（包括其头部）
        newGlbData.set(new Uint8Array(originalBinChunkAndHeader), newByteOffset);

        return newGlbBuffer;
    }
}