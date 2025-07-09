import { Scene } from "../external/three.module.js";
import { EventBus } from "./EventBus.js";
import { Utils } from "./Utils.js";

export class GSScene {
    constructor(eventBus, graphicsAPI) {
        this.eventBus = eventBus;
        this.eventBus.on('buffersReady', this.onBuffersReady.bind(this));
        this.scenes = {};
        this.graphicsAPI = graphicsAPI;

        this.destroyBufOnSetupTex = true;
    }

    async onBuffersReady({ buffers, sceneName }) {
        this.scenes[sceneName] = buffers;
        this.setupTex(sceneName);
    }

    setupTex(sceneName) {
        Object.values(this.scenes[sceneName]).forEach(buffers => {
            this.graphicsAPI.setupTexture(buffers);
            if (this.destroyBufOnSetupTex) {
                buffers.buffer = null;
            }
        });
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