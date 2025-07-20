

let wasmInstance;
let wasmMemory;
let useSharedMemory;
let integerBasedSort;
let dynamicMode;
let splatCount;
let indexesToSortOffset;
let sortedIndexesOffset;
let sceneIndexesOffset;
let transformsOffset;
let precomputedDistancesOffset;
let mappedDistancesOffset;
let frequenciesOffset;
let centersOffset;
let modelViewProjOffset;
let countsZero;
let sortedIndexesOut;
let distanceMapRange;
let uploadedSplatCount;
let Constants;

function sort(splatSortCount, splatRenderCount, modelViewProj,
              usePrecomputedDistances, copyIndexesToSort, copyPrecomputedDistances, copyTransforms) {
    const sortStartTime = performance.now();
    if (!useSharedMemory) {
        const indexesToSort = new Uint32Array(wasmMemory, indexesToSortOffset, copyIndexesToSort.byteLength / Constants.BytesPerInt);
        indexesToSort.set(copyIndexesToSort);
        const transforms = new Float32Array(wasmMemory, transformsOffset, copyTransforms.byteLength / Constants.BytesPerFloat);
        transforms.set(copyTransforms);
        if (usePrecomputedDistances) {
            let precomputedDistances;
            if (integerBasedSort) {
                precomputedDistances = new Int32Array(wasmMemory, precomputedDistancesOffset,
                                                      copyPrecomputedDistances.byteLength / Constants.BytesPerInt);
            } else {
                precomputedDistances = new Float32Array(wasmMemory, precomputedDistancesOffset,
                                                        copyPrecomputedDistances.byteLength / Constants.BytesPerFloat);
            }
            precomputedDistances.set(copyPrecomputedDistances);
        }
    }
    if (!countsZero) countsZero = new Uint32Array(distanceMapRange);
    new Float32Array(wasmMemory, modelViewProjOffset, 16).set(modelViewProj);
    new Uint32Array(wasmMemory, frequenciesOffset, distanceMapRange).set(countsZero);
    wasmInstance.exports.sortIndexes(indexesToSortOffset, centersOffset, precomputedDistancesOffset,
                                     mappedDistancesOffset, frequenciesOffset, modelViewProjOffset,
                                     sortedIndexesOffset, sceneIndexesOffset, transformsOffset, distanceMapRange,
                                     splatSortCount, splatRenderCount, splatCount, usePrecomputedDistances, integerBasedSort,
                                     dynamicMode);
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
    console.log(sortMessage, new Int32Array(wasmMemory, indexesToSortOffset, 10), new Int32Array(wasmMemory, mappedDistancesOffset, 10))
    self.postMessage(sortMessage);
}

self.onmessage = async (e) => {
    if (e.data.centers) { // TODO: change the code to 'update center' or just delete it
        const centers = e.data.centers;
        const sceneIndexes = e.data.sceneIndexes;
        console.log(e.data, centersOffset, wasmMemory)
        if (integerBasedSort) {
            new Int32Array(wasmMemory, centersOffset + e.data.range.from * Constants.BytesPerInt * 4,
                           e.data.range.count * 4).set(new Int32Array(centers));
        } else {
            new Float32Array(wasmMemory, centersOffset + e.data.range.from * Constants.BytesPerFloat * 4,
                             e.data.range.count * 4).set(new Float32Array(centers));
        }
        if (dynamicMode) {
            new Uint32Array(wasmMemory, sceneIndexesOffset + e.data.range.from * 4,
                            e.data.range.count).set(new Uint32Array(sceneIndexes));
        }
        uploadedSplatCount = e.data.range.from + e.data.range.count;
    } else if (e.data.sort) {
        const renderCount = Math.min(e.data.sort.splatRenderCount || 0, uploadedSplatCount);
        const sortCount = Math.min(e.data.sort.splatSortCount || 0, uploadedSplatCount);
        const usePrecomputedDistances = e.data.sort.usePrecomputedDistances;
        let copyIndexesToSort;
        let copyPrecomputedDistances;
        let copyTransforms;
        if (!useSharedMemory) {
            copyIndexesToSort = e.data.sort.indexesToSort;
            copyTransforms = e.data.sort.transforms;
            if (usePrecomputedDistances) copyPrecomputedDistances = e.data.sort.precomputedDistances;
        }
        sort(sortCount, renderCount, e.data.sort.modelViewProj, usePrecomputedDistances,
             copyIndexesToSort, copyPrecomputedDistances, copyTransforms);
    } else if (e.data.init) {
        const data = e.data.init;
        // Yep, this is super hacky and gross :(
        Constants = data.Constants;
        splatCount = data.splatCount;
        useSharedMemory = data.useSharedMemory;
        integerBasedSort = data.integerBasedSort;
        dynamicMode = data.dynamicMode;
        distanceMapRange = data.distanceMapRange;
        uploadedSplatCount = 0;
        const CENTERS_BYTES_PER_ENTRY = integerBasedSort ? (Constants.BytesPerInt * 4) : (Constants.BytesPerFloat * 4);
        const matrixSize = 16 * Constants.BytesPerFloat;
        const memoryRequiredForIndexesToSort = splatCount * Constants.BytesPerInt;
        const memoryRequiredForCenters = splatCount * CENTERS_BYTES_PER_ENTRY;
        const memoryRequiredForModelViewProjectionMatrix = matrixSize;
        const memoryRequiredForPrecomputedDistances = integerBasedSort ?
                                                      (splatCount * Constants.BytesPerInt) : (splatCount * Constants.BytesPerFloat);
        const memoryRequiredForMappedDistances = splatCount * Constants.BytesPerInt;
        const memoryRequiredForSortedIndexes = splatCount * Constants.BytesPerInt;
        const memoryRequiredForIntermediateSortBuffers = integerBasedSort ? (distanceMapRange * Constants.BytesPerInt * 2) :
                                                                            (distanceMapRange * Constants.BytesPerFloat * 2);
        const memoryRequiredforTransformIndexes = dynamicMode ? (splatCount * Constants.BytesPerInt) : 0;
        const memoryRequiredforTransforms = dynamicMode ? (Constants.MaxScenes * matrixSize) : 0;
        const extraMemory = Constants.MemoryPageSize * 32;
        const totalRequiredMemory = memoryRequiredForIndexesToSort +
                                    memoryRequiredForCenters +
                                    memoryRequiredForModelViewProjectionMatrix +
                                    memoryRequiredForPrecomputedDistances +
                                    memoryRequiredForMappedDistances +
                                    memoryRequiredForIntermediateSortBuffers +
                                    memoryRequiredForSortedIndexes +
                                    memoryRequiredforTransformIndexes +
                                    memoryRequiredforTransforms +
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
        sceneIndexesOffset = sortedIndexesOffset + memoryRequiredForSortedIndexes;
        transformsOffset = sceneIndexesOffset + memoryRequiredforTransformIndexes;
        wasmMemory = sorterWasmImport.env.memory.buffer;

        // update centers
        const centers = data.centers;
        const sceneIndexes = data.sceneIndexes;
        if (integerBasedSort) {
            new Int32Array(wasmMemory, centersOffset + data.range.from * Constants.BytesPerInt * 4,
                           data.range.count * 4).set(new Int32Array(centers));
            console.log(new Int32Array(centers))
        } else {
            new Float32Array(wasmMemory, centersOffset + data.range.from * Constants.BytesPerFloat * 4,
                             data.range.count * 4).set(new Float32Array(centers));
        }
        if (dynamicMode) {
            new Uint32Array(wasmMemory, sceneIndexesOffset + data.range.from * 4,
                            data.range.count).set(new Uint32Array(sceneIndexes));
        }
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
                'transformsOffset': transformsOffset
            });
        } else {
            self.postMessage({
                'sortSetupPhase1Complete': true
            });
        }
    }
};


