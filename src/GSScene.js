import { Utils } from "./Utils.js";

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

    async onBuffersReady({ data, sceneName }) {
        this.ready = false;
        const oldScene = this.currentUID;
        // TODO: now we only support single scene
        const uid = data.uid;
        this.scenes[uid] = data;
        this.setupTex(uid);

        // set state: new scene is ready
        this.currentUID = uid;
        this.ready = true;
        this.destoryOldScene(oldScene);
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
    }

    forceSort() {
        if (this.currentUID) {
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