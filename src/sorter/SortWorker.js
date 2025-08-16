

let wasmInstance;
let wasmMemory;
let useSharedMemory;
let splatCount;
let indexesToSortOffset;
let sortedIndexesOffset;
let mappedDistancesOffset;
let frequenciesOffset;
let centersOffset;
let modelViewProjOffset;
let debugOffset;
let memsetZero;
let distanceMapRange;
let gsType;
let chunkBased;
let transferablesortedIndexesOut;
const Constants = {
    BytesPerFloat: 4,
    BytesPerInt: 4,
    MemoryPageSize: 65536, // 64KB
    MaxScenes: 32
};

function sort(modelViewProj, timestamp) {
    // TODO
    // if chunkBased, cull on wasm. related value: splatSortCount, indexToSort
    let splatSortCount = splatCount;
    const sortStartTime = performance.now();
    if (!memsetZero) memsetZero = new Uint32Array(distanceMapRange);
    new Float32Array(wasmMemory, modelViewProjOffset, 16).set(modelViewProj);
    new Uint32Array(wasmMemory, frequenciesOffset, distanceMapRange).set(memsetZero);
    const wasmStartTime = performance.now();
    wasmInstance.exports.sortIndexes(indexesToSortOffset, centersOffset,
                                     mappedDistancesOffset, frequenciesOffset, modelViewProjOffset,
                                     sortedIndexesOffset, distanceMapRange, timestamp,
                                     splatSortCount, splatCount, 
                                     gsType, debugOffset);
    const sortMessage = {
        'sortDone': true,
        'splatSortCount': splatSortCount,
        'sortTime': 0
    };
    const transferables = [];
    if (!useSharedMemory) {
        transferablesortedIndexesOut.set(new Uint32Array(wasmMemory, sortedIndexesOffset, splatSortCount));
        transferables.push(transferablesortedIndexesOut.buffer);
        sortMessage.sortedIndexes = transferablesortedIndexesOut;
    }
    const sortEndTime = performance.now();
    sortMessage.sortTime = sortEndTime - sortStartTime;
    self.postMessage(sortMessage, transferables);
}

self.onmessage = async (e) => {
    if (e.data.sort) {
        if (!useSharedMemory) {
            transferablesortedIndexesOut = e.data.sort.sortedIndexes;
        }
        sort(e.data.sort.modelViewProj, e.data.sort.timestamp);
    } else if (e.data.init) {
        if (wasmInstance || wasmMemory) {
            wasmInstance = null;
            wasmMemory = null;
        }

        const data = e.data.init;
        // Yep, this is super hacky and gross :(
        splatCount = data.splatCount;
        useSharedMemory = data.useSharedMemory;
        distanceMapRange = data.distanceMapRange;
        gsType = data.gsType;
        chunkBased = data.chunkBased;
        const CENTERS_BYTES_PER_ENTRY = data.centers.byteLength / splatCount;
        const matrixSize = 16 * Constants.BytesPerFloat;
        const memoryRequiredForIndexesToSort = splatCount * Constants.BytesPerInt;
        const memoryRequiredForCenters = splatCount * CENTERS_BYTES_PER_ENTRY;
        const memoryRequiredForModelViewProjectionMatrix = matrixSize;
        const memoryRequiredForMappedDistances = splatCount * Constants.BytesPerInt;
        const memoryRequiredForIntermediateSortBuffers = distanceMapRange * Constants.BytesPerInt;
        const memoryRequiredForSortedIndexes = splatCount * Constants.BytesPerInt;
        const memoryRequiredForDebug = 8 * 4;
        const extraMemory = Constants.MemoryPageSize * 32;
        const totalRequiredMemory = memoryRequiredForIndexesToSort +
                                    memoryRequiredForCenters +
                                    memoryRequiredForModelViewProjectionMatrix +
                                    memoryRequiredForMappedDistances +
                                    memoryRequiredForIntermediateSortBuffers +
                                    memoryRequiredForSortedIndexes +
                                    memoryRequiredForDebug +
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
        mappedDistancesOffset = modelViewProjOffset + memoryRequiredForModelViewProjectionMatrix;
        frequenciesOffset = mappedDistancesOffset + memoryRequiredForMappedDistances;
        sortedIndexesOffset = frequenciesOffset + memoryRequiredForIntermediateSortBuffers;
        debugOffset = sortedIndexesOffset + memoryRequiredForSortedIndexes;
        wasmMemory = sorterWasmImport.env.memory.buffer;

        // update centers
        new Int32Array(wasmMemory, centersOffset, data.centers.byteLength / Constants.BytesPerInt).set(new Int32Array(data.centers));
        // update indexToSort
        if (true || !chunkBased) {
            const index2sort = new Uint32Array(wasmMemory, indexesToSortOffset, splatCount);
            for (let i = 0; i < splatCount; ++i) {
                index2sort[i] = i;
            }
        }

        console.log('setup sort worker', data.sorterWasmUrl)
        if (useSharedMemory) {
            self.postMessage({
                'sortSetupPhase1Complete': true,
                'sortedIndexesBuffer': wasmMemory,
                'sortedIndexesOffset': sortedIndexesOffset,
                'transformsBuffer': wasmMemory,
            });
        } else {
            self.postMessage({
                'sortSetupPhase1Complete': true
            });
        }
    }
};


