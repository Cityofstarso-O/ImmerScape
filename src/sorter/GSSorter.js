import { Utils } from "../Utils.js";

export class GSSorter {
    constructor(options, eventBus) {
        this.sharedMemoryForWorkers = options.sharedMemoryForWorkers;
        this.enableSIMDInSort = options.enableSIMDInSort;
        this.gpuAcceleratedSort = options.gpuAcceleratedSort;

        this.worker = new Worker(new URL('SortWorker.js', import.meta.url), { type: 'module' });
        this.sourceWasm = '';
        this.initialized = false;
        this.sortRunning = false;

        this.sortWorkerSortedIndexes = null;
        this.sortWorkerIndexesToSort = null;
        this.sortWorkerPrecomputedDistances = null;

        this.eventBus = eventBus;
        this.eventBus.on('buffersReady', this.onBuffersReady.bind(this));
    }

    async onBuffersReady({ data, sceneName }) {
        const splatCount = data.num;
        this.initSorter(splatCount);
        // create centers for web worker
        const pospad = data.buffers.pospad;
        const pospadView = new DataView(pospad.buffer);
        const centersBuffer = new ArrayBuffer(4 * 4 * data.num);
        const centers = new Int32Array(centersBuffer);
        if (pospad.bytesPerTexel == 8) {
            // TODO: 
        } else if (pospad.bytesPerTexel == 16) {
            let offset = 0;
            for (let i = 0; i < data.num; ++i) {
                centers[i * 4 + 0] = Math.round(pospadView.getFloat32(offset + 0, true) * 1000.0);
                centers[i * 4 + 1] = Math.round(pospadView.getFloat32(offset + 4, true) * 1000.0);
                centers[i * 4 + 2] = Math.round(pospadView.getFloat32(offset + 8, true) * 1000.0);
                centers[i * 4 + 3] = 1 * 1000;
                offset += 16;
            }
        }

        this.worker.postMessage({
            'init': {
                'sorterWasmUrl': this.sourceWasm,
                'splatCount': splatCount,
                'useSharedMemory': this.sharedMemoryForWorkers,
                'distanceMapRange': 1 << 16,
                'centers': centers.buffer,
                'range': {
                    'from': 0,
                    'count': splatCount,
                }
            }
        }, [centers.buffer]);
    }

    sort(mvpMatrix, cameraPositionArray, splatRenderCount, splatSortCount) {
        const sortMessage = {
            'modelViewProj': mvpMatrix.elements,
            'cameraPosition': cameraPositionArray,
            'splatRenderCount': splatRenderCount,
            'splatSortCount': splatSortCount,
            'usePrecomputedDistances': this.gpuAcceleratedSort
        };
        if (!this.sharedMemoryForWorkers) {
            sortMessage.indexesToSort = this.sortWorkerIndexesToSort;
            if (this.gpuAcceleratedSort) {
                // TODO: deprecate using cpu to calc dist
                this.sortWorkerPrecomputedDistances = new Float32Array([9, 1, 3, 2, 4, 7, 6, 5, 8, 0]);
                sortMessage.precomputedDistances = this.sortWorkerPrecomputedDistances;
            }
        }
        console.log(sortMessage)
        this.worker.postMessage({
            'sort': sortMessage
        });
    }

    initSorter(splatCount) {
        this.worker.onmessage = (e) => {
            if (e.data.sortDone) {
                this.sortRunning = false;
                if (this.sharedMemoryForWorkers) {
                    // TODO
                } else {
                    const sortedIndexes = new Uint32Array(e.data.sortedIndexes.buffer, 0, e.data.splatRenderCount);
                    this.eventBus.emit('sortDone', sortedIndexes);
                }
                this.lastSortTime = e.data.sortTime;
            } else if (e.data.sortCanceled) {
                this.sortRunning = false;
            } else if (e.data.sortSetupPhase1Complete) {
                if (this.sharedMemoryForWorkers) {
                    this.sortWorkerSortedIndexes = new Uint32Array(e.data.sortedIndexesBuffer,
                                                                   e.data.sortedIndexesOffset, splatCount);
                    this.sortWorkerIndexesToSort = new Uint32Array(e.data.indexesToSortBuffer,
                                                                   e.data.indexesToSortOffset, splatCount);
                    this.sortWorkerPrecomputedDistances = new Int32Array(e.data.precomputedDistancesBuffer,
                                                                                 e.data.precomputedDistancesOffset,
                                                                                 splatCount);
                } else {
                    this.sortWorkerIndexesToSort = new Uint32Array(splatCount);
                    this.sortWorkerPrecomputedDistances = new Int32Array(splatCount);
                }
                for (let i = 0; i < splatCount; i++) this.sortWorkerIndexesToSort[i] = i;

                this.initialized = true;
                console.log('Sorting web worker initialized successfully.');
            }
        };

        this.worker.onerror = (event) => {
            console.error('Worker error:', event.message);
            console.error('Filename:', event.filename);
            console.error('Line:', event.lineno);
            console.error('Error object:', event.error);
        };

        const SorterWasm = 'sorter.wasm';
        const SorterWasmNoSIMD = 'sorter_no_simd.wasm';
        const SorterWasmNoSIMDNonShared = 'sorter_no_simd_non_shared.wasm';
        const SorterWasmNonShared = 'sorter_non_shared.wasm';
        this.sourceWasm = SorterWasm;

        if (!this.enableSIMDInSort) {
            this.sourceWasm = this.sharedMemoryForWorkers ? SorterWasmNoSIMD : SorterWasmNoSIMDNonShared;
        } else {
            this.sourceWasm = this.sharedMemoryForWorkers ? SorterWasm : SorterWasmNonShared;
        }
    }

}