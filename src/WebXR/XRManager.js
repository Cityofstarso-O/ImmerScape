// TODO
// control flow
// ffr fpsControl viewportScale msaa
// input
// move

import { EventDispatcher, WebXRController } from "three";
import * as THREE from "three";

export class XRManager extends EventDispatcher {
    constructor(eventBus, canvas, graphicsAPI) {
        super();
        this.eventBus = eventBus;
        this.canvas = canvas;
        this.graphicsAPI = graphicsAPI;

        // state
        this.env = {
            gpu: 'unknown',
            // special
            AppleVisionPro: false,
            // api support
            isXrCompatible: false,
            isApiSupported: false,       // Is navigator.xr available?
            // mode support
            immersiveVRSupported: false, // Is 'immersive-vr' session supported?
            immersiveARSupported: false, // Is 'immersive-ar' session supported?
            inlineSupported: false,      // Is 'inline' session supported?
        };
        this.running = false;
        this.sessionType = null;

        // objects
        this.xrSession = null;
        this.xrLayer = null;
        this.baseReferenceSpace = null;
        this.userReferenceSpace = null;

        // hand
        this.enableHandTracking = false;
        this.controllers = [];
        this.controllerInputSources = [];

        this.virtualScene = new THREE.Scene();
        this.virtualScene.add(this.getHand(0));
        this.virtualScene.add(this.getHand(1));


        this.onSessionEnd = this.onSessionEnd.bind(this);
        this.onInputSourcesChange = this.onInputSourcesChange.bind(this);
        this.onSessionEvent = this.onSessionEvent.bind(this);

        this.checkEnv();
    }

    get session() { return this.xrSession; }
    get enabledFeatures() { return this.xrSession.enabledFeatures; }
    get environmentBlendMode() { return this.xrSession.environmentBlendMode; }
    get isVR() { return Boolean(this.sessionType === 'immersive-vr'); }
    get isAR() { return Boolean(this.sessionType === 'immersive-ar'); }

    get inputSources() { return this.xrSession.inputSources; }
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
    set fixedFoveation(value) { this.xrLayer.fixedFoveation = Math.max(0, Math.min(value, 1)); }
    get fixedFoveation() { return this.xrLayer.fixedFoveation; }
    get fixedFoveationAvailable() { return Boolean(this.xrLayer.fixedFoveation); }

    get refSpace() { return this.userReferenceSpace; }
    get baseRefSpace() { return this.baseReferenceSpace; }

    updateClearColor(r, g, b, a) {
        let clearColor = true;

        // for all ar device, if we are running ar on ar device, then do not clear color buffer
        if (this.xrSession && this.xrSession.environmentBlendMode !== 'opaque' && this.isAR) {
            clearColor = false;
        }

        this.graphicsAPI.updateClearColor(r, g, b, a, clearColor, true);
    }

    updateControllers(frame) {
        for ( let i = 0; i < this.controllers.length; i ++ ) {
			const inputSource = this.controllerInputSources[ i ];
			const controller = this.controllers[ i ];
			if ( inputSource !== null && controller !== undefined ) {
				controller.update(inputSource, frame, this.userReferenceSpace);
			}
		}
    }

    getHand(index) {
		let controller = this.controllers[index];
		if (!controller) {
			controller = new WebXRController();
			this.controllers[index] = controller;
		}
		return controller.getHandSpace();
	}

    getController( index ) {
		let controller = this.controllers[ index ];
		if ( controller === undefined ) {
			controller = new WebXRController();
			this.controllers[ index ] = controller;
		}
		return controller.getTargetRaySpace();
	};

	getControllerGrip( index ) {
		let controller = this.controllers[ index ];
		if ( controller === undefined ) {
			controller = new WebXRController();
			this.controllers[ index ] = controller;
		}
		return controller.getGripSpace();
	}

    onInputSourcesChange( event ) {
		// Notify disconnected
		for ( let i = 0; i < event.removed.length; i ++ ) {
			const inputSource = event.removed[ i ];
			const index = this.controllerInputSources.indexOf( inputSource );
			if ( index >= 0 ) {
				this.controllerInputSources[ index ] = null;
				this.controllers[ index ].disconnect( inputSource );
			}
		}
		// Notify connected
		for ( let i = 0; i < event.added.length; i ++ ) {
			const inputSource = event.added[ i ];
			let controllerIndex = this.controllerInputSources.indexOf( inputSource );
			if ( controllerIndex === -1 ) {
				// Assign input source a controller that currently has no input source
				for ( let i = 0; i < this.controllers.length; i ++ ) {
					if ( i >= this.controllerInputSources.length ) {
						this.controllerInputSources.push( inputSource );
						controllerIndex = i;
						break;
					} else if ( this.controllerInputSources[ i ] === null ) {
						this.controllerInputSources[ i ] = inputSource;
						controllerIndex = i;
						break;
					}
				}
				// If all controllers do currently receive input we ignore new ones
				if ( controllerIndex === -1 ) break;
			}
			const controller = this.controllers[ controllerIndex ];
			if ( controller ) {
				controller.connect( inputSource );
			}
		}
	}

    onSessionEnd(event) {
        this.running = false;
        this.sessionType = null;
        // objects
        this.xrSession.removeEventListener('select',       this.onSessionEvent);
		this.xrSession.removeEventListener('selectstart',  this.onSessionEvent);
		this.xrSession.removeEventListener('selectend',    this.onSessionEvent);
		this.xrSession.removeEventListener('squeeze',      this.onSessionEvent);
		this.xrSession.removeEventListener('squeezestart', this.onSessionEvent);
		this.xrSession.removeEventListener('squeezeend',   this.onSessionEvent);
        this.xrSession.removeEventListener('end', this.onSessionEnd);
		this.xrSession.removeEventListener('inputsourceschange', this.onInputSourcesChange);
        this.xrSession = null;
        this.xrLayer = null;
        this.baseReferenceSpace = null;
        this.userReferenceSpace = null;
        // hand
        this.enableHandTracking = false;

        this.eventBus.emit('xrSessionEnd', {});
    }

    onSessionEvent(event) {
		const controllerIndex = this.controllerInputSources.indexOf( event.inputSource );
		if ( controllerIndex === -1 ) {
			return;
		}
		const controller = this.controllers[ controllerIndex ];
		if ( controller !== undefined ) {
			controller.update(event.inputSource, event.frame, this.userReferenceSpace);
			controller.dispatchEvent( { type: event.type, data: event.inputSource } );
		}
	}

    async checkEnv() {
        this.env.gpu = this.parseGpuString(this.graphicsAPI.getGPU());
        // special
        if (this.env.gpu === 'Apple GPU') {
            this.env.AppleVisionPro = true;
        }
        // api support
        if (!navigator.xr) {
            this.env.isApiSupported = false;
            return this.env;
        }

        this.env.isApiSupported = true;
        // mode support
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

        // special
        if (this.env.AppleVisionPro) {
            this.env.immersiveARSupported = this.env.immersiveVRSupported;
        }

        this.eventBus.emit('noteExternalListener', {
            envInfo: true,
            env: this.env,
        })
        return this.env;
    }

    /**
     * 
     * @param {String} sessionType : 'immersive-vr' or 'immersive-ar'
     * @returns 
     */
    async initSession(sessionType) {
        if (!this.env.isXrCompatible) {
            const result = await this.tryMakeGlCompatible();
            if (!result) {
                return false;
            }
        }
        let sessionToRequest = sessionType;
        // special
        if (this.env.AppleVisionPro && sessionType === 'immersive-ar') {
            sessionToRequest = 'immersive-vr';
        }

        this.xrSession = await navigator.xr.requestSession(sessionToRequest, {
            requiredFeatures: ["local"],
            optionalFeatures: ['hand-tracking'],
        });
        this.sessionType = sessionType;
        await this.accessObjectsFromSession();

        this.xrSession.addEventListener('select',       this.onSessionEvent);
		this.xrSession.addEventListener('selectstart',  this.onSessionEvent);
		this.xrSession.addEventListener('selectend',    this.onSessionEvent);
		this.xrSession.addEventListener('squeeze',      this.onSessionEvent);
		this.xrSession.addEventListener('squeezestart', this.onSessionEvent);
		this.xrSession.addEventListener('squeezeend',   this.onSessionEvent);
        this.xrSession.addEventListener('end', this.onSessionEnd);
        this.xrSession.addEventListener('inputsourceschange', this.onInputSourcesChange);

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

        this.enableHandTracking = this.enabledFeatures.includes('hand-tracking');
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