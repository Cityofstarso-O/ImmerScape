import { WebGL } from "./backend/webgl.js";
import { EventBus } from "./EventBus.js";
import { GSLoader } from "./GSLoader/Loader.js";
import { GSScene } from "./GSScene.js";
import { ShaderManager } from "./ShaderManager.js";
import { GSSorter } from "./sorter/GSSorter.js";
import { Utils } from "./Utils.js";
import { OrbitControls } from './controls/OrbitControls.js';
import { PointerLockControls } from './controls/PointerLockCotrols.js';
import * as THREE from "three"


export default class GSViewer {
    constructor() {
        this.canvas = document.getElementById('drop-zone');
        this.graphicsAPI = new WebGL(this.canvas);
        this.eventBus = new EventBus();
        this.options = {
            debug: false,
            destroyOnLoad: false,
            sharedMemoryForWorkers: false,
            enableSIMDInSort: true,
            gpuAcceleratedSort: false,
            cacheShaders: false,
            enablePointerLock: true,

            initialCameraPosition: undefined,
            cameraUp: undefined,
            initialCameraLookAt: undefined,
            cameraFOV: undefined,

            isMobile: undefined,
        }
        this.__resolveOptions();

        this.devicePixelRatio = window.devicePixelRatio;
        this.canvas.width = this.canvas.clientWidth * this.devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * this.devicePixelRatio;
        this.perspectiveCamera = null;
        this.camera = null;
        this.initialCameraPosition = this.options.initialCameraPosition;
        this.cameraUp = this.options.cameraUp;
        this.initialCameraLookAt = this.options.initialCameraLookAt;
        this.cameraFOV = this.options.cameraFOV;

        // mobile: only support orbitControls
        // pc: support orbit and pointerLock without lock(useAsFlyControls = true)
        //     only when enablePointerLockControls = true and useAsFlyControls = false, we lock pointer.
        this.orbitControls = null;
        this.pointerLockControls = null;
        this.useAsFlyControls = true;   // a flag to decide two states of this.pointerLockControls
        this.controls = null;

        // Movement State
        this.isWDown = false;
        this.isSDown = false;
        this.isADown = false;
        this.isDDown = false;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.isLeftMouseDown = false;

        this.splatRenderCount = 0;
        this.splatSortCount = 0;

        this.startTime = performance.now();
        this.elapsedTime = 0;
        this.loopedTime = 0;
        this.lastFPSTime = 0;
        this.frameCount = 0;
        this.fps = 30;
        this.lastFrameTime = 0;
        this.deltaT = 0;

        this.gsloader = new GSLoader(this.eventBus);
        this.gsScene = new GSScene(this.options, this.eventBus, this.graphicsAPI);
        this.shaderManager = new ShaderManager(this.options, this.eventBus, this.graphicsAPI);
        this.sorter = new GSSorter(this.options, this.eventBus);

        this.eventBus.on('buffersReady', this.__onBuffersReady.bind(this));
        this.__setupCamera();
        this.__setupControls();
    }

    setControlMode(mode) {
        if (mode === 'orbit') {
            if (this.pointerLockControls) {
                this.pointerLockControls.enabled = false;
            }

            this.orbitControls.enabled = true;
            this.controls = this.orbitControls;
            return true;
        } else if (mode === 'pointerLock') {
            if (this.options.enablePointerLock) {
                this.orbitControls.enabled = false;

                this.useAsFlyControls = false;
                this.pointerLockControls.useAsFlyControls = this.useAsFlyControls;
                this.controls = this.pointerLockControls;
                this.pointerLockControls.enabled = true;
                return true;
            } else {
                return false;
            }
        } else if (mode === 'fly') {
            if (this.pointerLockControls) {
                this.orbitControls.enabled = false;

                this.useAsFlyControls = true;
                this.pointerLockControls.useAsFlyControls = this.useAsFlyControls;
                this.controls = this.pointerLockControls;
                this.pointerLockControls.enabled = true;
                return true;
            } else {
                return false;
            }
        }
    }

    lockPointer() {
        if (this.options.enablePointerLock && !this.useAsFlyControls) {
            this.pointerLockControls.lock();
        }
    }

    getFPS() {
        return this.fps;
    }

    getFrameTime() {
        return this.deltaT;
    }

    getSplatNum() {
        return this.gsScene.getSplatNum();
    }

    getLastSortTime() {
        return this.sorter.getLastSortTime();
    }

    getResolution() {
        return { width: this.canvas.width, height: this.canvas.height, dpr: this.devicePixelRatio };
    }

    fetchSceneWithURL(url) {
        // TODO: this is just for show
        this.gsloader.readFileFromServer(url);
    }

    fetchSceneWithNative(file) {
        this.gsloader.readFileFromNative(file);
    }

    attemptToSwitchQuality(target) {

    }

    run() {

        const animate = (currentTime) => {
            requestAnimationFrame(animate);

            this.frameCount++;
            if (currentTime - this.lastFPSTime >= 1000) {
                this.fps = this.frameCount;
                this.frameCount = 0;
                this.lastFPSTime = currentTime;
            }
            this.elapsedTime = currentTime - this.startTime;
            this.loopedTime = (this.elapsedTime % 1000) / 1000;
            this.deltaT = currentTime - this.lastFrameTime;
            this.lastFrameTime = currentTime;

            this.__updateControls();
            this.__runSplatSort(this.gsScene.forceSort());
            this.__updateForRendererSizeChanges();

            if (this.__shouldRender()) {
                // TODO: bind instance index buffer
                this.__updateUniforms();
                this.graphicsAPI.updateViewport();

                if (this.options.debug) {
                    this.graphicsAPI.drawInstanced('TRIANGLE_FAN', 0, 4, this.gsScene.getSplatNum(), this.shaderManager.debugTF);
                    this.shaderManager.debugLog();
                }

                this.graphicsAPI.updateClearColor();
                this.graphicsAPI.drawInstanced('TRIANGLE_FAN', 0, 4, this.gsScene.getSplatNum());
            }
        }

        animate(performance.now());
    }

    __shouldRender = function() {
        let isSet = false;
        return function(reset = false) {
            if (reset) {
                isSet = false;
                return;
            }
            const res = Boolean(this.gsScene.ready && this.sorter.ready && this.shaderManager.ready);
            if (!isSet && res) {
                this.graphicsAPI.setBlendState();
                this.shaderManager.setPipelineAndBind();
                this.shaderManager.updateUniformTextures(this.gsScene.getBuffers());
                isSet = true;
            }

            return res;
        }
    }();

    __onBuffersReady({ data, sceneName }) {
        this.__shouldRender(true);
        this.__runSplatSort(false, false, true);
    }

    __updateForRendererSizeChanges = function() {

        const lastRendererSize = new THREE.Vector2();
        const currentRendererSize = new THREE.Vector2();

        return function() {
            currentRendererSize.x = Math.round(this.canvas.clientWidth * this.devicePixelRatio);
            currentRendererSize.y = Math.round(this.canvas.clientHeight * this.devicePixelRatio);

            if (currentRendererSize.x !== lastRendererSize.x || currentRendererSize.y !== lastRendererSize.y) {
                this.canvas.width = currentRendererSize.x;
                this.canvas.height = currentRendererSize.y;
                this.camera.aspect = currentRendererSize.x / currentRendererSize.y;
                this.camera.updateProjectionMatrix();
                lastRendererSize.copy(currentRendererSize);
            }
        };
    }();

    __updateUniforms() {
        if (this.options.enablePointerLock && this.controls === this.pointerLockControls) {
            this.camera.updateMatrixWorld();
        }
        const projMat = this.camera.projectionMatrix.elements;
        this.shaderManager.updateUniform('viewMatrix', this.camera.matrixWorldInverse.elements);
        this.shaderManager.updateUniform('projectionMatrix', projMat);
        this.shaderManager.updateUniform('cameraPosition', this.camera.position.toArray());
        const focalX = projMat[0] * 0.5 * this.canvas.width;
        const focalY = projMat[5] * 0.5 * this.canvas.height;
        this.shaderManager.updateUniform('focal', [focalX, focalY]);
        this.shaderManager.updateUniform('invViewport', [1 / this.canvas.width, 1 / this.canvas.height]);
        this.shaderManager.updateUniform('timestamp', this.loopedTime);

        this.shaderManager.updateUniforms();
    }

    __runSplatSort = function() {
        let sortOnceForNewScene = true;
        const mvpMatrix = new THREE.Matrix4();
        const cameraPositionArray = [];
        const lastSortViewDir = new THREE.Vector3(0, 0, -1);
        const sortViewDir = new THREE.Vector3(0, 0, -1);
        const lastSortViewPos = new THREE.Vector3();
        const sortViewOffset = new THREE.Vector3();
        const queuedSorts = [];

        const partialSorts = [
            /*{
                'angleThreshold': 0.55,
                'sortFractions': [0.125, 0.33333, 0.75]
            },
            {
                'angleThreshold': 0.65,
                'sortFractions': [0.33333, 0.66667]
            },
            {
                'angleThreshold': 0.8,
                'sortFractions': [0.5]
            }*/
        ];

        return function(force = false, forceSortAll = false, reset = false) {
            if (reset) {
                sortOnceForNewScene = true;
                return Promise.resolve(false);
            }
            if (!this.sorter.ready) return Promise.resolve(false);
            if (this.sorter.sortRunning) return Promise.resolve(true);
            // TODO: we sort all splats for now
            // may use octree to cull on cpu, or compute distance on gpu then cull on wasm
            this.splatRenderCount = this.gsScene.getSplatNum();
            if (this.splatRenderCount <= 0) {
                return Promise.resolve(false);
            }

            /*if (this.splatMesh.getSplatCount() <= 0) {
                this.splatRenderCount = 0;
                return Promise.resolve(false);
            }*/

            let angleDiff = 0;
            let positionDiff = 0;
            let needsRefreshForRotation = false;
            let needsRefreshForPosition = false;

            sortViewDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
            angleDiff = sortViewDir.dot(lastSortViewDir);
            positionDiff = sortViewOffset.copy(this.camera.position).sub(lastSortViewPos).length();

            if (!(force || sortOnceForNewScene)) {
                if (queuedSorts.length === 0) {
                    if (angleDiff <= 0.99) needsRefreshForRotation = true;
                    if (positionDiff >= 1.0) needsRefreshForPosition = true;
                    if (!needsRefreshForRotation && !needsRefreshForPosition) return Promise.resolve(false);
                }
            }
            sortOnceForNewScene = false;
            //console.log("start to sortRunning");
            this.sorter.sortRunning = true;
            const shouldSortAll = forceSortAll;

            mvpMatrix.copy(this.camera.matrixWorld).invert();
            const mvpCamera = this.perspectiveCamera || this.camera;
            mvpMatrix.premultiply(mvpCamera.projectionMatrix);

            let gpuAcceleratedSortPromise = Promise.resolve(true);
            if (this.options.gpuAcceleratedSort && (queuedSorts.length <= 1 || queuedSorts.length % 2 === 0)) {
                // TODO: may use gpu in the future if cpu sort is too slow
                gpuAcceleratedSortPromise = this.splatMesh.computeDistancesOnGPU(mvpMatrix, this.sortWorkerPrecomputedDistances);
            }

            gpuAcceleratedSortPromise.then(() => {
                if (queuedSorts.length === 0) {
                    if (shouldSortAll) {
                        queuedSorts.push(this.splatRenderCount);
                    } else {
                        for (let partialSort of partialSorts) {
                            if (angleDiff < partialSort.angleThreshold) {
                                for (let sortFraction of partialSort.sortFractions) {
                                    queuedSorts.push(Math.floor(this.splatRenderCount * sortFraction));
                                }
                                break;
                            }
                        }
                        queuedSorts.push(this.splatRenderCount);
                    }
                }
                let sortCount = Math.min(queuedSorts.shift(), this.splatRenderCount);
                this.splatSortCount = sortCount;

                cameraPositionArray[0] = this.camera.position.x;
                cameraPositionArray[1] = this.camera.position.y;
                cameraPositionArray[2] = this.camera.position.z;

                this.sorter.sort(mvpMatrix, cameraPositionArray, this.splatRenderCount, this.splatSortCount, this.loopedTime);

                if (queuedSorts.length === 0) {
                    lastSortViewPos.copy(this.camera.position);
                    lastSortViewDir.copy(sortViewDir);
                }

                return true;
            });

            return gpuAcceleratedSortPromise;
        };

    }();

    __resolveOptions() {
        // iOS makes choosing the right WebAssembly configuration tricky :(
        const iOSSemVer = Utils.isIOS() ? Utils.getIOSSemever() : null;
        if (iOSSemVer) {
            this.options.sharedMemoryForWorkers = this.options.sharedMemoryForWorkers && !(iOSSemVer.major <= 16 && iOSSemVer.minor < 4);
        }

        this.options.initialCameraPosition = new THREE.Vector3().fromArray(this.options.initialCameraPosition || [0, 0, -2]);
        this.options.cameraUp = new THREE.Vector3().fromArray(this.options.cameraUp || [0, -1, 0]);
        this.options.initialCameraLookAt = new THREE.Vector3().fromArray(this.options.initialCameraLookAt || [0, 0, 0]);
        this.options.cameraFOV = this.options.cameraFOV || 60;

        this.options.isMobile = Utils.isMobile();

        if (this.options.enablePointerLock) {
            if (!document.getElementById('blocker') || this.options.isMobile) {
                console.warn("Warn: Blocker element with ID 'blocker' not found. Set 'enablePointerLock' to False");
                this.options.enablePointerLock = false;
            }
        }
    }

    __setupCamera() {
        const renderDimensions = new THREE.Vector2(this.width, this.height);

        this.perspectiveCamera = new THREE.PerspectiveCamera(this.cameraFOV, renderDimensions.x / renderDimensions.y, 0.1, 1000);
        this.camera = this.perspectiveCamera;
        this.camera.position.copy(this.initialCameraPosition);
        this.camera.up.copy(this.cameraUp).normalize();
        this.camera.lookAt(this.initialCameraLookAt);
    }

    __onKeyDown(event) {
        if (this.controls !== this.pointerLockControls) return;
        switch (event.code) {
            case 'KeyW': this.isWDown = true; break;
            case 'KeyA': this.isADown = true; break;
            case 'KeyS': this.isSDown = true; break;
            case 'KeyD': this.isDDown = true; break;
        }
    }

    __onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.isWDown = false; break;
            case 'KeyA': this.isADown = false; break;
            case 'KeyS': this.isSDown = false; break;
            case 'KeyD': this.isDDown = false; break;
        }
    }

    __onMouseDown(event) {
        // event.button === 0 is the left mouse button
        if (event.button === 0) {
            this.isLeftMouseDown = true;
            if (this.pointerLockControls) {
                this.pointerLockControls.isLeftMouseDown = this.isLeftMouseDown;
            }
        }
    }

    __onMouseUp(event) {
        // event.button === 0 is the left mouse button
        if (event.button === 0) {
            this.isLeftMouseDown = false;
            if (this.pointerLockControls) {
                this.pointerLockControls.isLeftMouseDown = this.isLeftMouseDown;
            }
        }
    }

    __setupControls() {
        this.orbitControls = new OrbitControls(this.camera, this.canvas);
        this.orbitControls.listenToKeyEvents(window);
        this.orbitControls.rotateSpeed = 0.5;
        this.orbitControls.maxPolarAngle = Math.PI * .75;
        this.orbitControls.minPolarAngle = 0.1;
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.target.copy(this.initialCameraLookAt);
        this.orbitControls.update();

        // TODO: add tuo luo yi for mobile device
        if (!this.options.isMobile) {
            this.pointerLockControls = new PointerLockControls(this.camera, this.canvas);
            if (this.options.enablePointerLock) {
                this.pointerLockControls.addEventListener('lock', () => {
                    document.getElementById('blocker').style.display = 'none';
                });
                this.pointerLockControls.addEventListener('unlock', () => {
                    document.getElementById('blocker').style.display = 'block';
                });
            }
        }
        document.addEventListener('keydown', this.__onKeyDown.bind(this));
        document.addEventListener('keyup', this.__onKeyUp.bind(this));
        document.addEventListener('mousedown', this.__onMouseDown.bind(this));
        document.addEventListener('mouseup', this.__onMouseUp.bind(this));
        
        this.controls = this.orbitControls;
        this.controls.update();
    }

    __updatePointerLockMovement() {
        const t = this.deltaT / 1000;   // ms => s
        this.velocity.x -= this.velocity.x * 10.0 * t;
        this.velocity.z -= this.velocity.z * 10.0 * t;
        this.direction.z = Number(this.isWDown) - Number(this.isSDown);
        this.direction.x = Number(this.isDDown) - Number(this.isADown);
        this.direction.normalize();

        if (this.isWDown || this.isSDown) this.velocity.z -= this.direction.z * 100.0 * t;
        if (this.isADown || this.isDDown) this.velocity.x -= this.direction.x * 100.0 * t;
        this.pointerLockControls.moveRight(-this.velocity.x * t);
        this.pointerLockControls.moveForward(-this.velocity.z * t);
    }

    __updateControls() {
        if (this.controls == this.orbitControls) {
            this.controls.update();
        } else if (this.controls == this.pointerLockControls && (this.useAsFlyControls || (!this.useAsFlyControls && this.controls.isLocked))) {
            this.__updatePointerLockMovement();
        }
    }
}