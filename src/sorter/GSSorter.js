import { GSType } from "../Global.js";

export class GSSorter {
    constructor(options, eventBus) {
        this.sharedMemoryForWorkers = options.sharedMemoryForWorkers;
        this.enableSIMDInSort = options.enableSIMDInSort;

        this.worker = new Worker(new URL('./SortWorker.js', import.meta.url), { type: 'module' });
        this.sourceWasm = '';
        this.ready = false;
        this.sortRunning = false;
        this.chunkBased = false;
        this.sortForFirstFrame = false;

        this.splatSortCount = 0;
        this.splatCount = 0;

        this.lastSortTime = 0;
        this.lastCullTime = 0;

        this.sortWorkerSortedIndexes = null;

        this.eventBus = eventBus;
        this.eventBus.on('buffersReady', this.onBuffersReady.bind(this));
    }

    getLastSortTime() {
        return this.lastSortTime;
    }

    getLastCullTime() {
        return this.lastCullTime;
    }

    getSplatSortCount() {
        return this.splatSortCount;
    }

    async onBuffersReady({ data, sceneName }) {
        this.ready = false;
        this.chunkBased = Boolean(data.chunkBased);
        this.splatCount = data.num;
        this.initSorter(this.splatCount);

        this.worker.postMessage({
            'init': {
                'sorterWasmUrl': this.sourceWasm,
                'splatCount': this.splatCount,
                'useSharedMemory': this.sharedMemoryForWorkers,
                'distanceMapRange': 1 << 16,
                'centers': data.sortBuffer,
                'gsType': GSType[data.gsType],
                'chunkBased': this.chunkBased,
                'chunks': data.chunkBuffer,
                'chunkNum': data.chunkNum,
                'chunkResolution': this.chunkBased ? data.chunkResolution : null,
            }
        }/*, [data.sortBuffer]*/);
    }

    sort(mvpMatrix, sceneScale, cameraPositionArray, timestamp, sortForFirstFrame) {
        const sortMessage = {
            'modelViewProj': mvpMatrix.elements,
            'sceneScale': sceneScale,
            'cameraPosition': cameraPositionArray,
            'timestamp': sortForFirstFrame ? 0 : timestamp,
        };
        // NOTE: when rendering 4dgs, we should always sort for current timestamp.
        // when sharedMemory is not available and the scene is large, 
        // the high frequency of copying and allocation of worker message may cause `out of memory`
        // in case of that we allocate once and transfer objects between main thread and worker
        const transferables = [];
        if (!this.sharedMemoryForWorkers) {
            if (!this.sortWorkerSortedIndexes.length) {
                return; // sortWorkerSortedIndexes is not yet transferred back
            }
            sortMessage.sortedIndexes = this.sortWorkerSortedIndexes;
            transferables.push(sortMessage.sortedIndexes.buffer);
        }
        this.worker.postMessage({
            'sort': sortMessage
        }, transferables);
        if (sortForFirstFrame) {
            this.sortForFirstFrame = true;
        }
    }

    initSorter(splatCount) {
        this.worker.onmessage = (e) => {
            if (e.data.sortDone) {
                if (this.sharedMemoryForWorkers) {
                    // TODO
                } else {
                    this.sortWorkerSortedIndexes = e.data.sortedIndexes;

                    const sortedIndexes = this.sortWorkerSortedIndexes.slice(0, e.data.splatSortCount);
                    this.eventBus.emit('sortDone', sortedIndexes);
                    if (this.sortForFirstFrame) {
                        this.eventBus.emit('sortForFirstFrameDone', {});
                        this.sortForFirstFrame = false;
                    }
                }
                this.splatSortCount = e.data.splatSortCount;
                this.lastSortTime = e.data.sortTime;
                this.lastCullTime = e.data.cullTime;
                this.sortRunning = false;
                console.log(`visible: ${this.splatSortCount}/${this.splatCount} (${(this.splatSortCount/this.splatCount*100).toFixed(2)}%)`,  
                    `cullTime: ${this.lastCullTime.toFixed(2)}ms`,
                    `sortTime: ${this.lastSortTime.toFixed(2)}ms`
                );
            } else if (e.data.sortCanceled) {
                this.sortRunning = false;
            } else if (e.data.sortSetupPhase1Complete) {
                if (this.sharedMemoryForWorkers) {
                    this.sortWorkerSortedIndexes = new Uint32Array(e.data.sortedIndexesBuffer,
                                                                   e.data.sortedIndexesOffset, splatCount);
                } else {
                    this.sortWorkerSortedIndexes = new Uint32Array(splatCount);
                }

                this.ready = true;
                console.log('Sorting web worker initialized successfully.');
            }
        };

        this.worker.onerror = (event) => {
            console.error('Worker error:', event.message);
            console.error('Filename:', event.filename);
            console.error('Line:', event.lineno);
            console.error('Error object:', event.error);
        };

        const SorterWasm = './wasm/sorter.wasm';
        const SorterWasmNoSIMD = './wasm/sorter_no_simd.wasm';
        const SorterWasmNoSIMDNonShared = './wasm/sorter_no_simd_non_shared.wasm';
        const SorterWasmNonShared = './wasm/sorter_non_shared.wasm';
        this.sourceWasm = SorterWasm;

        if (!this.enableSIMDInSort) {
            this.sourceWasm = this.sharedMemoryForWorkers ? SorterWasmNoSIMD : SorterWasmNoSIMDNonShared;
        } else {
            this.sourceWasm = this.sharedMemoryForWorkers ? SorterWasm : SorterWasmNonShared;
        }
    }

}