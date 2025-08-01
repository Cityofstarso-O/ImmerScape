

let wasmInstance;
let wasmMemory;
let useSharedMemory;
let splatCount;
let indexesToSortOffset;
let sortedIndexesOffset;
let precomputedDistancesOffset;
let mappedDistancesOffset;
let frequenciesOffset;
let centersOffset;
let modelViewProjOffset;
let memsetZero;
let sortedIndexesOut;
let distanceMapRange;
let uploadedSplatCount;
let gsType;
const Constants = {
    BytesPerFloat: 4,
    BytesPerInt: 4,
    MemoryPageSize: 65536, // 64KB
    MaxScenes: 32
};

function sort(splatSortCount, splatRenderCount, modelViewProj,
              usePrecomputedDistances, copyIndexesToSort, copyPrecomputedDistances, timestamp) {
    const sortStartTime = performance.now();
    if (!useSharedMemory) {
        const indexesToSort = new Uint32Array(wasmMemory, indexesToSortOffset, copyIndexesToSort.byteLength / Constants.BytesPerInt);
        indexesToSort.set(copyIndexesToSort);
        if (usePrecomputedDistances) {
            let precomputedDistances = new Int32Array(wasmMemory, precomputedDistancesOffset,
                                                      copyPrecomputedDistances.byteLength / Constants.BytesPerInt);
            precomputedDistances.set(copyPrecomputedDistances);
        }
    }
    if (!memsetZero) memsetZero = new Uint32Array(distanceMapRange);
    new Float32Array(wasmMemory, modelViewProjOffset, 16).set(modelViewProj);
    new Uint32Array(wasmMemory, frequenciesOffset, distanceMapRange).set(memsetZero);
    wasmInstance.exports.sortIndexes(indexesToSortOffset, centersOffset, precomputedDistancesOffset,
                                     mappedDistancesOffset, frequenciesOffset, modelViewProjOffset,
                                     sortedIndexesOffset, distanceMapRange, timestamp,
                                     splatSortCount, splatRenderCount, splatCount, 
                                     usePrecomputedDistances, gsType);
    const sortMessage = {
        'sortDone': true,
        'splatSortCount': splatSortCount,
        'splatRenderCount': splatRenderCount,
        'sortTime': 0
    };
    if (!useSharedMemory) {
        const sortedIndexes = new Uint32Array(wasmMemory, sortedIndexesOffset, splatRenderCount);
        if (!sortedIndexesOut || sortedIndexesOut.length < splatRenderCount) {
            sortedIndexesOut = new Uint32Array(splatRenderCount);
        }
        sortedIndexesOut.set(sortedIndexes);
        sortMessage.sortedIndexes = sortedIndexesOut;
    }
    const sortEndTime = performance.now();
    sortMessage.sortTime = sortEndTime - sortStartTime;
    self.postMessage(sortMessage);
}

self.onmessage = async (e) => {
    if (e.data.centers) { // TODO: change the code to 'update center' or just delete it
        const centers = e.data.centers;
        const sceneIndexes = e.data.sceneIndexes;
        console.log(e.data, centersOffset, wasmMemory)
        new Int32Array(wasmMemory, centersOffset + e.data.range.from * Constants.BytesPerInt * 4,
                           e.data.range.count * 4).set(new Int32Array(centers));
        uploadedSplatCount = e.data.range.from + e.data.range.count;
    } else if (e.data.sort) {
        const renderCount = Math.min(e.data.sort.splatRenderCount || 0, uploadedSplatCount);
        const sortCount = Math.min(e.data.sort.splatSortCount || 0, uploadedSplatCount);
        const usePrecomputedDistances = e.data.sort.usePrecomputedDistances;
        let copyIndexesToSort;
        let copyPrecomputedDistances;
        if (!useSharedMemory) {
            copyIndexesToSort = e.data.sort.indexesToSort;
            if (usePrecomputedDistances) copyPrecomputedDistances = e.data.sort.precomputedDistances;
        }
        sort(sortCount, renderCount, e.data.sort.modelViewProj, usePrecomputedDistances,
             copyIndexesToSort, copyPrecomputedDistances, e.data.sort.timestamp);
    } else if (e.data.init) {
        const data = e.data.init;
        // Yep, this is super hacky and gross :(
        splatCount = data.splatCount;
        useSharedMemory = data.useSharedMemory;
        distanceMapRange = data.distanceMapRange;
        gsType = data.gsType;
        uploadedSplatCount = 0;
        const CENTERS_BYTES_PER_ENTRY = data.centers.byteLength / splatCount;
        const matrixSize = 16 * Constants.BytesPerFloat;
        const memoryRequiredForIndexesToSort = splatCount * Constants.BytesPerInt;
        const memoryRequiredForCenters = splatCount * CENTERS_BYTES_PER_ENTRY;
        const memoryRequiredForModelViewProjectionMatrix = matrixSize;
        const memoryRequiredForPrecomputedDistances = splatCount * Constants.BytesPerInt;
        const memoryRequiredForMappedDistances = splatCount * Constants.BytesPerInt;
        const memoryRequiredForIntermediateSortBuffers = distanceMapRange * Constants.BytesPerInt;
        const memoryRequiredForSortedIndexes = splatCount * Constants.BytesPerInt;
        const extraMemory = Constants.MemoryPageSize * 32;
        const totalRequiredMemory = memoryRequiredForIndexesToSort +
                                    memoryRequiredForCenters +
                                    memoryRequiredForModelViewProjectionMatrix +
                                    memoryRequiredForPrecomputedDistances +
                                    memoryRequiredForMappedDistances +
                                    memoryRequiredForIntermediateSortBuffers +
                                    memoryRequiredForSortedIndexes +
                                    extraMemory;
        const totalPagesRequired = Math.floor(totalRequiredMemory / Constants.MemoryPageSize ) + 1;

        const memory = new WebAssembly.Memory({
            initial: totalPagesRequired,
            maximum: totalPagesRequired,
            shared: useSharedMemory, // Use the flag here
        });

        const sorterWasmImport = {
            module: {},
            env: { memory: memory }
        };

        // Efficiently load the Wasm module from the provided URL
        try {
            const { instance } = await WebAssembly.instantiateStreaming(fetch(data.sorterWasmUrl), sorterWasmImport);
            wasmInstance = instance;
        } catch (error) {
            // Fallback for browsers that don't support instantiateStreaming (e.g., some Safari versions)
            const response = await fetch(data.sorterWasmUrl);
            const wasmBytes = await response.arrayBuffer();
            const wasmModule = await WebAssembly.compile(wasmBytes);
            wasmInstance = await WebAssembly.instantiate(wasmModule, sorterWasmImport);
        }

        indexesToSortOffset = 0;
        centersOffset = indexesToSortOffset + memoryRequiredForIndexesToSort;
        modelViewProjOffset = centersOffset + memoryRequiredForCenters;
        precomputedDistancesOffset = modelViewProjOffset + memoryRequiredForModelViewProjectionMatrix;
        mappedDistancesOffset = precomputedDistancesOffset + memoryRequiredForPrecomputedDistances;
        frequenciesOffset = mappedDistancesOffset + memoryRequiredForMappedDistances;
        sortedIndexesOffset = frequenciesOffset + memoryRequiredForIntermediateSortBuffers;
        wasmMemory = sorterWasmImport.env.memory.buffer;

        // update centers
        const centers = data.centers;
        new Int32Array(wasmMemory, centersOffset + data.range.from * Constants.BytesPerInt * 4).set(new Int32Array(centers));
        uploadedSplatCount = data.range.from + data.range.count;

        console.log('setup sort worker', data.sorterWasmUrl)
        if (useSharedMemory) {
            self.postMessage({
                'sortSetupPhase1Complete': true,
                'indexesToSortBuffer': wasmMemory,
                'indexesToSortOffset': indexesToSortOffset,
                'sortedIndexesBuffer': wasmMemory,
                'sortedIndexesOffset': sortedIndexesOffset,
                'precomputedDistancesBuffer': wasmMemory,
                'precomputedDistancesOffset': precomputedDistancesOffset,
                'transformsBuffer': wasmMemory,
            });
        } else {
            self.postMessage({
                'sortSetupPhase1Complete': true
            });
        }
    }
};


