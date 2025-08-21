// TODO
// control flow
// ffr fpsControl viewportScale msaa
// input
// move

export class XRManager {
    constructor(eventBus, canvas, graphicsAPI) {
        this.eventBus = eventBus;
        this.canvas = canvas;
        this.graphicsAPI = graphicsAPI;

        // state
        this.env = {
            gpu: 'unknown',
            isXrCompatible: false,
            isApiSupported: false,       // Is navigator.xr available?
            immersiveVRSupported: false, // Is 'immersive-vr' session supported?
            immersiveARSupported: false, // Is 'immersive-ar' session supported?
            inlineSupported: false,      // Is 'inline' session supported?
        };
        this.running = false;
        this.sessionType = null;

        this.xrSession = null;
        this.xrLayer = null;
        this.baseReferenceSpace = null;
        this.userReferenceSpace = null;

        this.checkEnv();
    }

    get session() { return this.xrSession; }
    get enabledFeatures() { return this.xrSession.enabledFeatures; }

    get depthNear() { return this.xrSession.renderState.depthNear; }
    get depthFar() { return this.xrSession.renderState.depthFar; }

    get baseLayer() { return this.xrLayer; }
    get framebuffer() { return this.xrLayer.framebuffer; }
    get framebufferWidth() { return this.xrLayer.framebufferWidth; }
    get framebufferHeight() { return this.xrLayer.framebufferHeight; }
    get antialias() { return this.xrLayer.antialias; }
    /**
     * 设置注视点渲染级别。
     * @param {number} value - 渲染级别，通常在 0 到 1 之间。
     */
    set fixedFoveation(value) { this.xrLayer.fixedFoveation = Math.min(0, Math.max(value, 1)); }
    get fixedFoveation() { return this.xrLayer.fixedFoveation; }
    get fixedFoveationAvailable() { return Boolean(this.xrLayer.fixedFoveation); }

    get refSpace() { return this.userReferenceSpace; }
    get baseRefSpace() { return this.baseReferenceSpace; }

    isAR() {
        return this.sessionType === 'immersive-ar';
    }

    async checkEnv() {
        this.env.gpu = this.parseGpuString(this.graphicsAPI.getGPU());
        if (!navigator.xr) {
            this.env.isApiSupported = false;
            return this.env;
        }

        this.env.isApiSupported = true;

        try {
            this.env.immersiveVRSupported = await navigator.xr.isSessionSupported('immersive-vr');
        } catch (e) {
            this.env.immersiveVRSupported = false;
        }

        try {
            this.env.immersiveARSupported = await navigator.xr.isSessionSupported('immersive-ar');
        } catch (e) {
            this.env.immersiveARSupported = false;
        }

        try {
            this.env.inlineSupported = await navigator.xr.isSessionSupported('inline');
        } catch (e) {
            this.env.inlineSupported = false;
        }
        this.eventBus.emit('noteExternalListener', {
            envInfo: true,
            env: this.env,
        })
        return this.env;
    }

    async initSession(sessionType) {
        if (!this.env.isXrCompatible) {
            const result = await this.tryMakeGlCompatible();
            if (!result) {
                return false;
            }
        }

        this.xrSession = await navigator.xr.requestSession(sessionType, {
            requiredFeatures: ["local"],
            optionalFeatures: []
        });
        this.sessionType = sessionType;
        await this.accessObjectsFromSession();

        this.xrSession.addEventListener('end', () => {
            this.running = false;
            this.xrSession = null;
            this.sessionType = null;
            this.baseReferenceSpace = null;
            this.userReferenceSpace = null;
            this.eventBus.emit('xrSessionEnd', {});
        });
        this.running = true;
        console.log(`Successfully enter ${this.sessionType}`);
        return true;
    }

    async accessObjectsFromSession() {
        this.xrLayer = new XRWebGLLayer(this.xrSession, this.graphicsAPI.getContext());
        await this.xrSession.updateRenderState({ baseLayer: this.xrLayer });
        this.baseReferenceSpace = await this.xrSession.requestReferenceSpace('local');

        const transform = new XRRigidTransform({ x: 0, y: 0, z: -2 }, { x: 1, y: 0, z: 0, w: 0 });
        this.userReferenceSpace = this.baseReferenceSpace.getOffsetReferenceSpace(transform);
    }

    frameRateControl = function() {
        let targetFPSIdx = 0;
        let enale = false;

        return function(currentFPS, reset = false) {
            if (reset) {
                targetFPSIdx = 0;
                enale = this.xrSession.frameRate && this.xrSession.supportedFrameRates && this.xrSession.updateTargetFrameRate;
                return;
            }
            if (!enale) {
                return;
            }

            const supportedRates = session.supportedFrameRates;
            const length = supportedRates.length;

            if (currentFPS < supportedRates[targetFPSIdx]) {
                if (targetFPSIdx > 0) {
                    this.xrSession.updateTargetFrameRate(supportedRates[targetFPSIdx - 1]).then(() => {
                        targetFPSIdx--;
                    });
                }
            } else {
                if (targetFPSIdx < length - 1 && currentFPS > supportedRates[targetFPSIdx + 1]) {
                    this.xrSession.updateTargetFrameRate(supportedRates[targetFPSIdx + 1]).then(() => {
                        targetFPSIdx++;
                    });
                }
            }
        }
    }();

    async tryMakeGlCompatible() {
        try {
            await this.graphicsAPI.makeXRCompatible();
            this.env.isXrCompatible = true;
            return true;
        } catch (e) {
            console.log(e)
            return false;
        }
    }

    parseGpuString(fullGpuString) {
        if (!fullGpuString) return 'unknown';
        
        // Regex to find common GPU names and exclude trailing technical details
        const regex = /(NVIDIA GeForce.*?|AMD Radeon.*?|Intel\(R\).*?Graphics|Apple M\d.*?)(?=\s*\()/i;
        const match = fullGpuString.match(regex);
        
        // If a clean name is found, return it
        if (match && match[1]) {
            return match[1].trim();
        }
        
        // Fallback for less common strings
        try {
            const contentInParens = fullGpuString.substring(fullGpuString.indexOf('(') + 1, fullGpuString.lastIndexOf(')'));
            const parts = contentInParens.split(',');
            if (parts.length > 1) {
                return parts[1].trim();
            }
        } catch (e) {
            // Ignore parsing errors
        }
        return fullGpuString; // If all else fails, return the original string
    };
}