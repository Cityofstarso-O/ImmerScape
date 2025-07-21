import { Utils } from "./Utils.js";

export class GSScene {
    constructor(options, eventBus, graphicsAPI) {
        this.eventBus = eventBus;
        this.eventBus.on('buffersReady', this.onBuffersReady.bind(this));
        this.scenes = {};
        this.currentScene = '';
        this.graphicsAPI = graphicsAPI;

        this.destroyBufOnSetupTex = options.destroyBufOnSetupTex;
    }

    async onBuffersReady({ data, sceneName }) {
        // TODO: now we only support single scene
        this.scenes[sceneName] = data;
        this.setupTex(sceneName);
        this.currentScene = sceneName;
        GSScene.debugUnpackBuffer(data.buffers, 0);
        GSScene.debugUnpackBuffer(data.buffers, 1);
        GSScene.debugUnpackBuffer(data.buffers, 2);
    }

    setupTex(sceneName) {
        Object.values(this.scenes[sceneName].buffers).forEach(value => {
            this.graphicsAPI.setupTexture(value);
            if (this.destroyBufOnSetupTex) {
                value.buffer = null;
            }
        });
        console.log(this.scenes[sceneName])
    }

    getSplatNum() {
        if (this.currentScene && this.scenes[this.currentScene]) {
            return this.scenes[this.currentScene].num;
        }
        return 0;
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