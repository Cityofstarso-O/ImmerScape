import { WebGL } from "./backend/webgl.js";
import { EventBus } from "./EventBus.js";
import { GSLoader } from "./GSLoader/Loader.js";
import { GSScene } from "./GSScene.js";
import { ShaderManager } from "./ShaderManager.js";
import { GSSorter } from "./sorter/GSSorter.js";
import { Utils } from "./Utils.js";
import { OrbitControls } from './controls/OrbitControls.js';
import { PointerLockControls } from './controls/PointerLockCotrols.js';
import { SceneHelper } from './SceneHelper/sceneHelper.js';
import { RenderMode } from "./Global.js";
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
            cacheShaders: true,
            enablePointerLock: true,

            initialCameraPosition: undefined,
            cameraUp: undefined,
            initialCameraLookAt: undefined,
            cameraFOV: undefined,

            isMobile: undefined,
        }
        this.__resolveOptions();

        this.devicePixelRatio = window.devicePixelRatio;
        this.canvas.width  = Math.round(this.canvas.clientWidth  * this.devicePixelRatio);
        this.canvas.height = Math.round(this.canvas.clientHeight * this.devicePixelRatio);
        this.perspectiveCamera = null;
        this.camera = null;
        this.initialCameraPosition = this.options.initialCameraPosition;
        this.cameraUp = this.options.cameraUp;
        this.initialCameraLookAt = this.options.initialCameraLookAt;
        this.cameraFOV = this.options.cameraFOV;
        this.backgroundColor = [0.15, 0.15, 0.15];

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
        this.isYDown = false;   // freeze Y
        this.isQDown = false;   // camera rotation
        this.isEDown = false;   // camera rotation
        this.freezeY = false;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.isLeftMouseDown = false;

        this.startTime = performance.now();
        this.elapsedTime = 0;
        this.loopedTime = 0;
        this.lastFPSTime = 0;
        this.frameCount = 0;
        this.fps = 30;
        this.lastFrameTime = 0;
        this.deltaT = 0;

        this.renderMode = RenderMode.splat;
        this.showGrid = true;
        this.showGizmo = true;

        this.gsloader = new GSLoader(this.eventBus);
        this.gsScene = new GSScene(this.options, this.eventBus, this.graphicsAPI);
        this.shaderManager = new ShaderManager(this.options, this.eventBus, this.graphicsAPI);
        this.sorter = new GSSorter(this.options, this.eventBus);
        this.sceneHelper = new SceneHelper(this.canvas, this.graphicsAPI);

        this.eventBus.on('buffersReady', this.__onBuffersReady.bind(this));
        this.__setupCamera();
        this.__setupControls();

        this.sceneHelper.init(this.camera)
    }

    setControlMode(mode) {
        if (mode === 'orbit') {
            if (this.pointerLockControls) {
                this.pointerLockControls.enabled = false;
            }

            this.orbitControls.enabled = true;
            this.controls = this.orbitControls;
            this.camera.controls = this.controls;
            this.controls.type = 'orbit';
            return true;
        } else if (mode === 'pointerLock') {
            if (this.options.enablePointerLock) {
                this.orbitControls.enabled = false;

                this.useAsFlyControls = false;
                this.pointerLockControls.useAsFlyControls = this.useAsFlyControls;
                this.controls = this.pointerLockControls;
                this.pointerLockControls.enabled = true;
                this.camera.controls = this.controls;
                this.controls.type = 'pointerLock';
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
                this.camera.controls = this.controls;
                this.controls.type = 'fly';
                return true;
            } else {
                return false;
            }
        }
    }

    setRenderMode(mode) {
        const value = RenderMode[mode];
        if (value && value > 0) {
            this.renderMode = value;
        }
    }

    setGridVisibility(visible) {
        this.showGrid = visible;
    }

    setGizmoVisibility(visible) {
        this.showGizmo = visible;
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

    getLastCullTime() {
        return this.sorter.getLastCullTime();
    }

    getCullingPercentage() {    // which means visible splats number
        // trick: for static 3dgs scene, force to sort once per sec
        // this.__runSplatSort(true);
        return this.sorter.getSplatSortCount() / this.gsScene.getSplatNum();
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

    removeScene(uid) {
        this.gsScene.removeScene(uid);
    }

    switchToScene(uid) {
        this.gsScene.switchToScene(uid);
    }

    attemptToSwitchQuality(target) {

    }

    addExternalListener(func) {
        this.eventBus.on('noteExternalListener', func);
    }

    applyTransform() {
        this.gsScene.applyTransform();
    }

    resetTransform() {
        this.gsScene.resetTransform();
    }

    updateTransform() {
        this.gsScene.updateTransform();
        // force to sort for new transformed scene
        this.__runSplatSort(false, true);
    }

    setBackgroundColor(r, g, b) {
        this.backgroundColor = [r, g, b];
    }

    updateCamera = function() {
        const target = new THREE.Vector3();

        return function(cameraSettings) {
            if (this.devicePixelRatio != cameraSettings.dpr) {
                this.devicePixelRatio = cameraSettings.dpr;
            }
            const rgb = Utils.hex2rgb(cameraSettings.backgroundColor);
            if (Utils.valueChanged(this.backgroundColor, rgb)) {
                this.setBackgroundColor(rgb[0], rgb[1], rgb[2]);
            }
            this.camera.fov = cameraSettings.fov;
            this.camera.near = cameraSettings.clip.n;
            this.camera.far = cameraSettings.clip.f;
            this.camera.updateProjectionMatrix();
            if (this.controls.type === 'orbit') {
                this.camera.up.x = cameraSettings.up.x;
                this.camera.up.y = cameraSettings.up.y;
                this.camera.up.z = cameraSettings.up.z;
                this.camera.position.x = cameraSettings.pos.x;
                this.camera.position.y = cameraSettings.pos.y;
                this.camera.position.z = cameraSettings.pos.z;
                this.controls.target.x = cameraSettings.look.x;
                this.controls.target.y = cameraSettings.look.y;
                this.controls.target.z = cameraSettings.look.z;
            } else {
                this.camera.up.x = cameraSettings.up.x;
                this.camera.up.y = cameraSettings.up.y;
                this.camera.up.z = cameraSettings.up.z;
                this.camera.position.x = cameraSettings.pos.x;
                this.camera.position.y = cameraSettings.pos.y;
                this.camera.position.z = cameraSettings.pos.z;
                target.set(cameraSettings.look.x, cameraSettings.look.y, cameraSettings.look.z).add(this.camera.position);
                this.camera.lookAt(target);
            }
        }
    }();

    resetCamera() {
        this.camera.position.copy(this.initialCameraPosition);
        this.camera.up.copy(this.cameraUp).normalize();
        this.camera.lookAt(this.initialCameraLookAt);
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
            this.sceneHelper.update(currentTime, this.deltaT);

            this.graphicsAPI.updateClearColor(this.backgroundColor[0], this.backgroundColor[1], this.backgroundColor[2], 1);
            this.graphicsAPI.updateViewport();
            if (this.showGrid) {
                this.sceneHelper.renderGrid();
            }
            if (this.__shouldRender()) {
                // pass 0: gaussian splatting
                this.shaderManager.setPipeline();
                this.__updateUniforms();

                if (this.options.debug) {
                    this.graphicsAPI.drawInstanced('TRIANGLE_FAN', 0, 4, this.gsScene.getSplatNum(), this.shaderManager.debugTF);
                    this.shaderManager.debugLog();
                }
                this.graphicsAPI.drawInstanced('TRIANGLE_FAN', 0, 4, this.sorter.getSplatSortCount());
            }
            if (this.showGizmo) {
                this.sceneHelper.renderGizmo();
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
                // these states only need to set once
                this.graphicsAPI.setBlendState();
                this.shaderManager.setPipeline();
                this.shaderManager.updateUniformTextures(this.gsScene.getBuffers());
                this.shaderManager.updateUniforms(true);
                isSet = true;
                this.eventBus.emit('noteExternalListener', {
                    sceneLoaded: true,
                    uid: this.gsScene.getCurrentScene('uid'),
                    name: this.gsScene.getCurrentScene('name'),
                    transform: this.gsScene.getCurrentScene('transform'),
                })
            }

            return res;
        }
    }();

    __onBuffersReady({ data, sceneName }) {
        this.__shouldRender(true);
        this.__runSplatSort(false, true);
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
                this.sceneHelper._onAspectChanged();
            }
        };
    }();

    __updateUniforms = function() {
        const newViewMatrix = new THREE.Matrix4();

        return function() {
            if (this.options.enablePointerLock && this.controls === this.pointerLockControls) {
                //this.camera.updateMatrixWorld();
            }
            const projMat = this.camera.projectionMatrix.elements;
            newViewMatrix.copy(this.gsScene.getCurrentScene('modelMatrix'));
            newViewMatrix.premultiply(this.camera.matrixWorldInverse);

            this.shaderManager.updateUniform('viewMatrix', newViewMatrix.elements);
            this.shaderManager.updateUniform('projectionMatrix', projMat);
            this.shaderManager.updateUniform('cameraPosition', this.camera.position.toArray(), true);
            const focalX = projMat[0] * 0.5 * this.canvas.width;
            const focalY = projMat[5] * 0.5 * this.canvas.height;
            this.shaderManager.updateUniform('focal', [focalX, focalY], true);
            this.shaderManager.updateUniform('invViewport', [1 / this.canvas.width, 1 / this.canvas.height], true);
            this.shaderManager.updateUniform('timestamp', this.loopedTime);
            this.shaderManager.updateUniform('sceneScale', this.gsScene.getCurrentScene('sceneScale'));
            this.shaderManager.updateUniform('renderMode', this.renderMode);

            this.shaderManager.updateUniforms();
        }
    }();

    __runSplatSort = function() {
        let sortOnceForNewScene = true;
        const mvpMatrix = new THREE.Matrix4();
        const cameraPositionArray = [];
        const lastSortViewDir = new THREE.Vector3(0, 0, -1);
        const sortViewDir = new THREE.Vector3(0, 0, -1);
        const lastSortViewPos = new THREE.Vector3();
        const sortViewOffset = new THREE.Vector3();

        return function(force = false, reset = false) {
            if (reset) {
                sortOnceForNewScene = true;
                return Promise.resolve(false);
            }
            if (!this.sorter.ready) return Promise.resolve(false);
            if (this.sorter.sortRunning) return Promise.resolve(true);
            // we sort all splats
            // culling on wasm if chunkBased, or we just sort all splats
            if (this.gsScene.getSplatNum() <= 0) {
                return Promise.resolve(false);
            }

            this.camera.getWorldDirection(sortViewDir);
            const angleDiff = sortViewDir.dot(lastSortViewDir);
            const positionDiff = sortViewOffset.copy(this.camera.position).sub(lastSortViewPos).length();
            if (angleDiff < 0.995 || positionDiff >= 0.5) {
                this.eventBus.emit('noteExternalListener', {
                    cameraUpdate: true,
                    position: this.camera.position,
                    look: this.controls.type === 'orbit' ? this.controls.target : sortViewDir,
                    up: this.camera.up,
                });
            }

            if (!(force || sortOnceForNewScene)) {
                let needsRefreshForRotation = false;
                let needsRefreshForPosition = false;
                if (angleDiff < 0.995) needsRefreshForRotation = true;
                if (positionDiff >= 1.0) needsRefreshForPosition = true;
                if (!needsRefreshForRotation && !needsRefreshForPosition) return Promise.resolve(false);
            }
            sortOnceForNewScene = false;

            // start to sort
            this.sorter.sortRunning = true;

            mvpMatrix.copy(this.gsScene.getCurrentScene('modelMatrix'));
            mvpMatrix.premultiply(this.camera.matrixWorldInverse);
            mvpMatrix.premultiply(this.camera.projectionMatrix);

            cameraPositionArray[0] = this.camera.position.x;
            cameraPositionArray[1] = this.camera.position.y;
            cameraPositionArray[2] = this.camera.position.z;

            this.sorter.sort(mvpMatrix, cameraPositionArray, this.loopedTime);

            lastSortViewPos.copy(this.camera.position);
            lastSortViewDir.copy(sortViewDir);
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
        switch (event.code) {
            case 'KeyQ': this.isQDown = true; break;
            case 'KeyE': this.isEDown = true; break;
        }
        if (this.controls !== this.pointerLockControls) return;
        switch (event.code) {
            case 'KeyW': this.isWDown = true; break;
            case 'KeyA': this.isADown = true; break;
            case 'KeyS': this.isSDown = true; break;
            case 'KeyD': this.isDDown = true; break;
            case 'KeyY': this.isYDown = true; break;
        }
    }

    __onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.isWDown = false; break;
            case 'KeyA': this.isADown = false; break;
            case 'KeyS': this.isSDown = false; break;
            case 'KeyD': this.isDDown = false; break;
            case 'KeyY': this.isYDown = false; this.freezeY = !this.freezeY; break;
            case 'KeyQ': this.isQDown = false; break;
            case 'KeyE': this.isEDown = false; break;
        }
    }

    __onMouseDown(event) {
        // event.button === 0 is the left mouse button
        if (event.button === 0) {
            this.isLeftMouseDown = true;
            if (this.pointerLockControls) {
                this.pointerLockControls.isLeftMouseDown = this.isLeftMouseDown;
            }
            this.eventBus.emit('noteExternalListener', {
                startDrag: true,
            });
        }
    }

    __onMouseUp(event) {
        // event.button === 0 is the left mouse button
        if (event.button === 0) {
            this.isLeftMouseDown = false;
            if (this.pointerLockControls) {
                this.pointerLockControls.isLeftMouseDown = this.isLeftMouseDown;
            }
            this.sceneHelper._onMouseUp();
            this.eventBus.emit('noteExternalListener', {
                endDrag: true,
            });
        }
    }

    __onMouseMove(event) {
        if (this.pointerLockControls) {
            this.pointerLockControls._onMouseMove(event);
        }
        this.sceneHelper._onMouseMove(event);
    }

    __setupControls() {
        this.orbitControls = new OrbitControls(this.camera, this.canvas);
        this.orbitControls.listenToKeyEvents(window);
        this.orbitControls.rotateSpeed = 0.5;
        //this.orbitControls.maxPolarAngle = Math.PI * .75;
        //this.orbitControls.minPolarAngle = 0.1;
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
        this.canvas.addEventListener('mousedown', this.__onMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this.__onMouseUp.bind(this));
        this.canvas.addEventListener('mousemove', this.__onMouseMove.bind(this));
        
        this.controls = this.orbitControls;
        this.controls.type = 'orbit';
        this.controls.update();
        this.camera.controls = this.controls;

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
        this.pointerLockControls.moveForward(-this.velocity.z * t, this.freezeY);
    }

    __updateControls() {
        this.__updateCameraRotate();
        if (this.controls == this.orbitControls) {
            this.controls.update();
        } else if (this.controls == this.pointerLockControls && (this.useAsFlyControls || (!this.useAsFlyControls && this.controls.isLocked))) {
            this.__updatePointerLockMovement();
        }
    }

    __updateCameraRotate = function() {
        const forwardVector = new THREE.Vector3();
        const target = new THREE.Vector3(); 
        const rollSpeed = 0.001;

        return function() {
            this.camera.getWorldDirection(forwardVector);
            let update = false;
            if (this.isQDown) {
                this.camera.up.applyAxisAngle(forwardVector, rollSpeed * this.deltaT);
                update = true;
            }
            if (this.isEDown) {
                this.camera.up.applyAxisAngle(forwardVector, -rollSpeed * this.deltaT);
                update = true;
            }

            if (update) {
                if (this.controls === this.pointerLockControls) {
                    target.copy(this.camera.position).add(forwardVector);
                    this.camera.lookAt(target);
                }
                this.eventBus.emit('noteExternalListener', {
                    cameraUpdate: true,
                    position: this.camera.position,
                    look: this.controls.type === 'orbit' ? this.controls.target : forwardVector,
                    up: this.camera.up,
                })
            }
        }
    }();
}