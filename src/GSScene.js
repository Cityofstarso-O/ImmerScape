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
}