import { Scene } from "../external/three.module.js";
import { EventBus } from "./EventBus.js";
import { Utils } from "./Utils.js";

export class GSScene {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.eventBus.on('buffersReady', this.onBuffersReady.bind(this));
    }

    onBuffersReady({ buffers, sceneName }) {
        console.log(`GSScene starts to handle ${sceneName}`);
    }

    static debugUnpackBuffer(buffers, idx = 0) {
        const poscol = new DataView(buffers.poscol.buffer, buffers.poscol.bytesPerTexel * idx);
        console.log('pos', poscol.getFloat32(0, true), poscol.getFloat32(4, true), poscol.getFloat32(8, true))
        console.log('col', Utils.uint82float(poscol.getUint8(12, true)),
            Utils.uint82float(poscol.getUint8(13, true)),
            Utils.uint82float(poscol.getUint8(14, true)),
            Utils.uint82float(poscol.getUint8(15, true))
        )
        const cov = new DataView(buffers.covpad.buffer, buffers.covpad.bytesPerTexel * idx);
        console.log('cov', Utils.uint162fp162f(cov.getUint16(0, true)),
            Utils.uint162fp162f(cov.getUint16(2, true)),
            Utils.uint162fp162f(cov.getUint16(4, true)),
            Utils.uint162fp162f(cov.getUint16(6, true)),
            Utils.uint162fp162f(cov.getUint16(8, true)),
            Utils.uint162fp162f(cov.getUint16(10, true))
        )
    }
}