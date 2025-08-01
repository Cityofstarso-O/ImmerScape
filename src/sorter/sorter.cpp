#include <emscripten/emscripten.h>
#include <iostream>

#ifdef __wasm_simd128__
#include <wasm_simd128.h>
#endif

#ifdef __cplusplus
#define EXTERN extern "C"
#else
#define EXTERN
#endif

#define computeMatMul4x4ThirdRow(a, b, out) \
    out[0] = a[2] * b[0] +  a[6] * b[1] + a[10] * b[2] + a[14] * b[3]; \
    out[1] = a[2] * b[4] +  a[6] * b[5] + a[10] * b[6] + a[14] * b[7]; \
    out[2] = a[2] * b[8] +  a[6] * b[9] + a[10] * b[10] + a[14] * b[11]; \
    out[3] = a[2] * b[12] +  a[6] * b[13] + a[10] * b[14] + a[14] * b[15];

EXTERN EMSCRIPTEN_KEEPALIVE void sortIndexes(unsigned int* indexes, int* centers, int* precomputedDistances, 
                                             int* mappedDistances, unsigned int * frequencies, float* modelViewProj,
                                             unsigned int* indexesOut, unsigned int distanceMapRange, float timestamp,
                                             unsigned int sortCount, unsigned int renderCount, unsigned int splatCount, 
                                             bool usePrecomputedDistances, int gsType)
{
    int maxDistance = -2147483640;
    int minDistance = 2147483640;

    unsigned int sortStart = renderCount - sortCount;

    if (usePrecomputedDistances) {
        for (unsigned int i = sortStart; i < renderCount; i++) {
            int distance = precomputedDistances[indexes[i]];
            mappedDistances[i] = distance;
            if (distance > maxDistance) maxDistance = distance;
            if (distance < minDistance) minDistance = distance;
        }
    } else if (gsType == 1) {   // ThreeD
        int iMVPRow3[4] = {(int)(modelViewProj[2] * 1000.0), (int)(modelViewProj[6] * 1000.0), (int)(modelViewProj[10] * 1000.0), 1};
#ifdef __wasm_simd128__
        int tempOut[4];
        v128_t b = wasm_v128_load(&iMVPRow3[0]);
        for (unsigned int i = sortStart; i < renderCount; i++) {
            v128_t a = wasm_v128_load(&centers[4 * indexes[i]]);
            v128_t prod = wasm_i32x4_mul(a, b);
            wasm_v128_store(&tempOut[0], prod);
            int distance = tempOut[0] + tempOut[1] + tempOut[2];
            mappedDistances[i] = distance;
            if (distance > maxDistance) maxDistance = distance;
            if (distance < minDistance) minDistance = distance;
        }
#else
        for (unsigned int i = sortStart; i < renderCount; i++) {
            unsigned int indexOffset = 4 * (unsigned int)indexes[i];
            int distance =
                (int)((iMVPRow3[0] * centers[indexOffset] +
                       iMVPRow3[1] * centers[indexOffset + 1] +
                       iMVPRow3[2] * centers[indexOffset + 2]));
            mappedDistances[i] = distance;
            if (distance > maxDistance) maxDistance = distance;
            if (distance < minDistance) minDistance = distance;
        }
#endif
    } else if (gsType == 2) {   // SpaceTime
        int iMVPRow3[4] = {(int)(modelViewProj[2] * 1000.0), (int)(modelViewProj[6] * 1000.0), (int)(modelViewProj[10] * 1000.0), 1};
        float fMVPRow3[4] = { modelViewProj[2], modelViewProj[6], modelViewProj[10], 1 };
#ifdef __wasm_simd128__
        
#else
        float* fCenters = (float*)centers;
        float tmpCenters[3];
        float deltaTPow, deltaT;
        for (unsigned int i = sortStart; i < renderCount; i++) {
            unsigned int indexOffset = 13 * (unsigned int)indexes[i];
            deltaTPow = 1.0f;
            deltaT = timestamp - fCenters[indexOffset + 12];
            tmpCenters[0] = tmpCenters[1] = tmpCenters[2] = 0.0f;
            for (int j = 0; j < 3; j++) {
                tmpCenters[0] += fCenters[indexOffset + 0 + 3 * j] * deltaTPow;
                tmpCenters[1] += fCenters[indexOffset + 1 + 3 * j] * deltaTPow;
                tmpCenters[2] += fCenters[indexOffset + 2 + 3 * j] * deltaTPow;
                deltaTPow *= deltaT;
            }
            int distance =
                (int)((fMVPRow3[0] * tmpCenters[0] +
                       fMVPRow3[1] * tmpCenters[1] +
                       fMVPRow3[2] * tmpCenters[2]) * 4096.0);
            mappedDistances[i] = distance;
            if (distance > maxDistance) maxDistance = distance;
            if (distance < minDistance) minDistance = distance;
        }
#endif
    }

    float distancesRange = (float)maxDistance - (float)minDistance;
    float rangeMap = (float)(distanceMapRange - 1) / distancesRange;

    for (unsigned int i = sortStart; i < renderCount; i++) {
        unsigned int frequenciesIndex = (int)((float)(mappedDistances[i] - minDistance) * rangeMap);
        mappedDistances[i] = frequenciesIndex;
        frequencies[frequenciesIndex] = frequencies[frequenciesIndex] + 1;   
    }

    unsigned int cumulativeFreq = frequencies[0];
    for (unsigned int i = 1; i < distanceMapRange; i++) {
        unsigned int freq = frequencies[i];
        cumulativeFreq += freq;
        frequencies[i] = cumulativeFreq;
    }

    for (int i = (int)sortStart - 1; i >= 0; i--) {
        indexesOut[i] = indexes[i];
    }

    for (int i = (int)renderCount - 1; i >= (int)sortStart; i--) {
        unsigned int frequenciesIndex = mappedDistances[i];
        unsigned int freq = frequencies[frequenciesIndex];
        indexesOut[renderCount - freq] = indexes[i];
        frequencies[frequenciesIndex] = freq - 1;
    }
}
