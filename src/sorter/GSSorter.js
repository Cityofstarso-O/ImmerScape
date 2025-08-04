import { GSType } from "../Global.js";

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

        this.worker.postMessage({
            'init': {
                'sorterWasmUrl': this.sourceWasm,
                'splatCount': splatCount,
                'useSharedMemory': this.sharedMemoryForWorkers,
                'distanceMapRange': 1 << 16,
                'centers': data.sortBuffer,
                'gsType': GSType[data.gsType],
                'range': {
                    'from': 0,
                    'count': splatCount,
                }
            }
        }, [data.sortBuffer]);
    }

    sort(mvpMatrix, cameraPositionArray, splatRenderCount, splatSortCount, timestamp) {
        const sortMessage = {
            'modelViewProj': mvpMatrix.elements,
            'cameraPosition': cameraPositionArray,
            'splatRenderCount': splatRenderCount,
            'splatSortCount': splatSortCount,
            'usePrecomputedDistances': this.gpuAcceleratedSort,
            'timestamp': timestamp,
        };
        // NOTE: when rendering 4dgs, we should always sort for current timestamp.
        // when sharedMemory is not available and the scene is large, 
        // the high frequency of copying and allocation of worker message may cause `out of memory`
        // in case of that we allocate once and transfer objects between main thread and worker
        const transferables = [];
        if (!this.sharedMemoryForWorkers) {
            if (!this.sortWorkerIndexesToSort.length) {
                return; // sortWorkerIndexesToSort is not yet transferred back
            }
            sortMessage.indexesToSort = this.sortWorkerIndexesToSort;
            transferables.push(sortMessage.indexesToSort.buffer);

            if (!this.sortWorkerSortedIndexes.length) {
                return; // sortWorkerSortedIndexes is not yet transferred back
            }
            sortMessage.sortedIndexes = this.sortWorkerSortedIndexes;
            transferables.push(sortMessage.sortedIndexes.buffer);
            if (this.gpuAcceleratedSort) {
                // TODO: deprecate using cpu to calc dist
                if (!this.sortWorkerPrecomputedDistances.length) {
                    return; // sortWorkerPrecomputedDistances is not yet transferred back
                }
                sortMessage.precomputedDistances = this.sortWorkerPrecomputedDistances;
                transferables.push(sortMessage.precomputedDistances.buffer)
            }
        }
        this.worker.postMessage({
            'sort': sortMessage
        }, transferables);
    }

    initSorter(splatCount) {
        this.worker.onmessage = (e) => {
            if (e.data.sortDone) {
                if (this.sharedMemoryForWorkers) {
                    // TODO
                } else {
                    this.sortWorkerSortedIndexes = e.data.sortedIndexes;
                    this.sortWorkerIndexesToSort = e.data.indexesToSort;
                    if (this.gpuAcceleratedSort) {
                        this.sortWorkerPrecomputedDistances = e.data.precomputedDistances;
                    }
                    const sortedIndexes = new Uint32Array(e.data.sortedIndexes.buffer, 0, e.data.splatRenderCount);
                    console.log(e.data.sortTime);
                    this.eventBus.emit('sortDone', sortedIndexes);
                }
                this.lastSortTime = e.data.sortTime;
                this.sortRunning = false;
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
                    this.sortWorkerSortedIndexes = new Uint32Array(splatCount);
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

        const SorterWasm = 'wasm/sorter.wasm';
        const SorterWasmNoSIMD = 'wasm/sorter_no_simd.wasm';
        const SorterWasmNoSIMDNonShared = 'wasm/sorter_no_simd_non_shared.wasm';
        const SorterWasmNonShared = 'wasm/sorter_non_shared.wasm';
        this.sourceWasm = SorterWasm;

        if (!this.enableSIMDInSort) {
            this.sourceWasm = this.sharedMemoryForWorkers ? SorterWasmNoSIMD : SorterWasmNoSIMDNonShared;
        } else {
            this.sourceWasm = this.sharedMemoryForWorkers ? SorterWasm : SorterWasmNonShared;
        }
    }

}