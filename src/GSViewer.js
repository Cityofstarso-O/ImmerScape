import { WebGL } from "./backend/webgl.js";
import { EventBus } from "./EventBus.js";
import { GSLoader } from "./GSLoader/Loader.js";
import { GSScene } from "./GSScene.js";
import { ShaderManager } from "./ShaderManager.js";
import { GSSorter } from "./sorter/GSSorter.js";
import { Utils } from "./Utils.js";
import { OrbitControls } from './OrbitControls.js';
import * as THREE from "../../external/three.module.js"


export class GSViewer {
    constructor() {
        this.canvas = document.getElementById('drop-zone');
        this.graphicsAPI = new WebGL(this.canvas);
        this.eventBus = new EventBus();
        this.options = {
            debug: false,
            integerBasedSort: true,
            destroyBufOnSetupTex: false,
            sharedMemoryForWorkers: false,
            enableSIMDInSort: true,
            startInOrthographicMode: false,
            gpuAcceleratedSort: false,

            initialCameraPosition: undefined,
            cameraUp: undefined,
            initialCameraLookAt: undefined,
            cameraFOV: undefined,
        }
        this.resolveOptions();

        this.devicePixelRatio = window.devicePixelRatio;
        this.canvas.width = this.canvas.clientWidth * this.devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * this.devicePixelRatio;
        this.perspectiveCamera = null;
        this.orthographicCamera = null;
        this.camera = null;
        this.initialCameraPosition = this.options.initialCameraPosition;
        this.cameraUp = this.options.cameraUp;
        this.initialCameraLookAt = this.options.initialCameraLookAt;
        this.cameraFOV = this.options.cameraFOV;

        this.perspectiveControls = null;
        this.orthographicControls = null;
        this.controls = null;

        this.splatRenderCount = 0;
        this.splatSortCount = 0;

        this.gsloader = new GSLoader(this.eventBus);
        this.gsScene = new GSScene(this.options, this.eventBus, this.graphicsAPI);
        this.shaderManager = new ShaderManager(this.options, this.eventBus, this.graphicsAPI);
        this.sorter = new GSSorter(this.options, this.eventBus);

        this.setupCamera();
        this.setupControls();
    }

    run() {
        const animate = () => {
            requestAnimationFrame(animate);
            if (this.controls) {
                this.controls.update();
                if (this.camera.isOrthographicCamera) {
                    GSViewer.setCameraPositionFromZoom(this.camera, this.camera, this.controls);
                }
            }
            this.runSplatSort();
            this.updateForRendererSizeChanges();

            if (this.shouldRender()) {
                // TODO: bind instance index buffer
                this.updateUniforms();
                this.graphicsAPI.updateViewport();

                if (this.options.debug) {
                    this.graphicsAPI.drawInstanced('TRIANGLE_FAN', 0, 4, this.gsScene.getSplatNum(), this.shaderManager.debugTF);
                    this.shaderManager.debugLog();
                }

                this.graphicsAPI.updateClearColor();
                this.graphicsAPI.drawInstanced('TRIANGLE_FAN', 0, 4, this.gsScene.getSplatNum());
            }
        }

        animate();
    }

    shouldRender = function() {
        let isSet = false;
        return function() {
            const res = this.gsScene.currentScene && this.sorter.initialized && this.shaderManager.key;
            if (res && !isSet) {
                this.shaderManager.setPipelineAndBind();
                this.shaderManager.updateUniformTextures(this.gsScene.getBuffers());
            }

            return res;
        }
    }();

    updateForRendererSizeChanges = function() {

        const lastRendererSize = new THREE.Vector2();
        const currentRendererSize = new THREE.Vector2();
        let lastCameraOrthographic;

        return function() {
            currentRendererSize.x = Math.round(this.canvas.clientWidth * this.devicePixelRatio);
            currentRendererSize.y = Math.round(this.canvas.clientHeight * this.devicePixelRatio);

            if (lastCameraOrthographic === undefined || lastCameraOrthographic !== this.camera.isOrthographicCamera ||
                currentRendererSize.x !== lastRendererSize.x || currentRendererSize.y !== lastRendererSize.y) {
                this.canvas.width = currentRendererSize.x;
                this.canvas.height = currentRendererSize.y;
                if (this.camera.isOrthographicCamera) {
                    this.camera.left = -currentRendererSize.x / 2.0;
                    this.camera.right = currentRendererSize.x / 2.0;
                    this.camera.top = currentRendererSize.y / 2.0;
                    this.camera.bottom = -currentRendererSize.y / 2.0;
                } else {
                    this.camera.aspect = currentRendererSize.x / currentRendererSize.y;
                }
                this.camera.updateProjectionMatrix();
                lastRendererSize.copy(currentRendererSize);
                lastCameraOrthographic = this.camera.isOrthographicCamera;
            }
        };
    }();

    updateUniforms() {
        const projMat = this.camera.projectionMatrix.elements;
        this.shaderManager.updateUniform('viewMatrix', this.camera.matrixWorldInverse.elements);
        this.shaderManager.updateUniform('projectionMatrix', projMat);
        this.shaderManager.updateUniform('cameraPosition', this.camera.position.toArray());
        const focalX = projMat[0] * 0.5 * this.canvas.width;
        const focalY = projMat[5] * 0.5 * this.canvas.height;
        this.shaderManager.updateUniform('focal', [focalX, focalY]);
        this.shaderManager.updateUniform('invViewport', [1 / this.canvas.width, 1 / this.canvas.height]);

        this.shaderManager.updateUniforms();
    }

    runSplatSort = function() {

        const mvpMatrix = new THREE.Matrix4();
        const cameraPositionArray = [];
        const lastSortViewDir = new THREE.Vector3(0, 0, -1);
        const sortViewDir = new THREE.Vector3(0, 0, -1);
        const lastSortViewPos = new THREE.Vector3();
        const sortViewOffset = new THREE.Vector3();
        const queuedSorts = [];

        const partialSorts = [
            {
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
            }
        ];

        return function(force = false, forceSortAll = false) {
            if (!this.sorter.initialized) return Promise.resolve(false);
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

            if (!force) {
                if (queuedSorts.length === 0) {
                    if (angleDiff <= 0.99) needsRefreshForRotation = true;
                    if (positionDiff >= 1.0) needsRefreshForPosition = true;
                    if (!needsRefreshForRotation && !needsRefreshForPosition) return Promise.resolve(false);
                }
            }
            console.log("start to sortRunning")
            this.sortRunning = true;
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

                this.sorter.sort(mvpMatrix, cameraPositionArray, this.splatRenderCount, this.splatSortCount);

                if (queuedSorts.length === 0) {
                    lastSortViewPos.copy(this.camera.position);
                    lastSortViewDir.copy(sortViewDir);
                }

                return true;
            });

            return gpuAcceleratedSortPromise;
        };

    }();

    resolveOptions() {
        // iOS makes choosing the right WebAssembly configuration tricky :(
        const iOSSemVer = Utils.isIOS() ? Utils.getIOSSemever() : null;
        if (iOSSemVer) {
            this.options.sharedMemoryForWorkers = this.options.sharedMemoryForWorkers && !(iOSSemVer.major <= 16 && iOSSemVer.minor < 4);
        }

        this.options.initialCameraPosition = new THREE.Vector3().fromArray(this.options.initialCameraPosition || [0, 0, -2]);
        this.options.cameraUp = new THREE.Vector3().fromArray(this.options.cameraUp || [0, 1, 0]);
        this.options.initialCameraLookAt = new THREE.Vector3().fromArray(this.options.initialCameraLookAt || [0, 0, 0]);
        this.options.cameraFOV = this.options.cameraFOV || 50;

    }

    setupCamera() {
        const renderDimensions = new THREE.Vector2(this.width, this.height);

        this.perspectiveCamera = new THREE.PerspectiveCamera(this.cameraFOV, renderDimensions.x / renderDimensions.y, 0.1, 1000);
        this.orthographicCamera = new THREE.OrthographicCamera(renderDimensions.x / -2, renderDimensions.x / 2,
                                                                   renderDimensions.y / 2, renderDimensions.y / -2, 0.1, 1000 );
        this.camera = this.options.startInOrthographicMode ? this.orthographicCamera : this.perspectiveCamera;
        this.camera.position.copy(this.initialCameraPosition);
        this.camera.up.copy(this.cameraUp).normalize();
        this.camera.lookAt(this.initialCameraLookAt);
    }

    setupControls() {
        this.perspectiveControls = new OrbitControls(this.perspectiveCamera, this.canvas);
        this.orthographicControls = new OrbitControls(this.orthographicCamera, this.canvas);

        for (let controls of [this.orthographicControls, this.perspectiveControls,]) {
            if (controls) {
                controls.listenToKeyEvents(window);
                controls.rotateSpeed = 0.5;
                controls.maxPolarAngle = Math.PI * .75;
                controls.minPolarAngle = 0.1;
                controls.enableDamping = true;
                controls.dampingFactor = 0.05;
                controls.target.copy(this.initialCameraLookAt);
                controls.update();
            }
        }
        this.controls = this.camera.isOrthographicCamera ? this.orthographicControls : this.perspectiveControls;
        this.controls.update();
    }

    static setCameraPositionFromZoom = function() {

        const tempVector = new THREE.Vector3();

        return function(positionCamera, zoomedCamera, controls) {
            const toLookAtDistance = 1 / (zoomedCamera.zoom * 0.001);
            tempVector.copy(controls.target).sub(positionCamera.position).normalize().multiplyScalar(toLookAtDistance).negate();
            positionCamera.position.copy(controls.target).add(tempVector);
        };

    }();
}