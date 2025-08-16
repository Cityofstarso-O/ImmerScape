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

        this.sortWorkerSortedIndexes = null;

        this.eventBus = eventBus;
        this.eventBus.on('buffersReady', this.onBuffersReady.bind(this));
    }

    getLastSortTime() {
        return this.lastSortTime;
    }

    async onBuffersReady({ data, sceneName }) {
        this.ready = false;
        this.chunkBased = Boolean(data.chunkBased);
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
                'chunkBased': this.chunkBased,
            }
        }/*, [data.sortBuffer]*/);
    }

    sort(mvpMatrix, cameraPositionArray, splatSortCount, timestamp) {
        const sortMessage = {
            'modelViewProj': mvpMatrix.elements,
            'cameraPosition': cameraPositionArray,
            'splatSortCount': splatSortCount,
            'timestamp': timestamp,
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
    }

    initSorter(splatCount) {
        this.worker.onmessage = (e) => {
            if (e.data.sortDone) {
                if (this.sharedMemoryForWorkers) {
                    // TODO
                } else {
                    this.sortWorkerSortedIndexes = e.data.sortedIndexes;

                    const sortedIndexes = new Uint32Array(e.data.sortedIndexes.buffer, 0, e.data.splatSortCount);
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