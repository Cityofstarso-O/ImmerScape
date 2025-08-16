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

EXTERN EMSCRIPTEN_KEEPALIVE void sortIndexes(unsigned int* indexes, void* centers, 
                                             int* mappedDistances, unsigned int * frequencies, float* modelViewProj,
                                             unsigned int* indexesOut, unsigned int distanceMapRange, float timestamp,
                                             unsigned int sortCount, unsigned int splatCount, 
                                             int gsType, float* debug)
{
    int maxDistance = -2147483640;
    int minDistance = 2147483640;

    unsigned int sortStart = sortCount - sortCount;

    if (gsType == 1) {   // ThreeD
        // always use int centers in this case
        int *iCenters = (int*)centers;
        int iMVPRow3[4] = {(int)(modelViewProj[2] * 1000.0), (int)(modelViewProj[6] * 1000.0), (int)(modelViewProj[10] * 1000.0), 1};
#ifdef __wasm_simd128__
        int tempOut[4];
        v128_t b = wasm_v128_load(&iMVPRow3[0]);
        for (unsigned int i = sortStart; i < sortCount; i++) {
            v128_t a = wasm_v128_load(&iCenters[4 * indexes[i]]);
            v128_t prod = wasm_i32x4_mul(a, b);
            wasm_v128_store(&tempOut[0], prod);
            int distance = tempOut[0] + tempOut[1] + tempOut[2];
            mappedDistances[i] = distance;
            if (distance > maxDistance) maxDistance = distance;
            if (distance < minDistance) minDistance = distance;
        }
#else
        for (unsigned int i = sortStart; i < sortCount; i++) {
            unsigned int indexOffset = 4 * (unsigned int)indexes[i];
            int distance =
                (int)((iMVPRow3[0] * iCenters[indexOffset] +
                       iMVPRow3[1] * iCenters[indexOffset + 1] +
                       iMVPRow3[2] * iCenters[indexOffset + 2]));
            mappedDistances[i] = distance;
            if (distance > maxDistance) maxDistance = distance;
            if (distance < minDistance) minDistance = distance;
        }
#endif
    } else if (gsType == 2) {   // SpaceTime
        // always use float centers for precision
        float fMVPRow3[4] = { modelViewProj[2] * 4096.f, modelViewProj[6] * 4096.f, modelViewProj[10] * 4096.f, 1 };
        float* fCenters = (float*)centers;
        float tmpCenters[4];
#ifdef __wasm_simd128__
        float deltaTPow[4] = { 1.0 };
        float tempOut[4];
        v128_t deltaTPowSIMD;
        v128_t mvpSIMD = wasm_v128_load(fMVPRow3);
        for (unsigned int i = sortStart; i < sortCount; i++) {
            unsigned int indexOffset = 13 * (unsigned int)indexes[i];

            deltaTPow[1] = timestamp - fCenters[indexOffset + 12];
            deltaTPow[2] = deltaTPow[1] * deltaTPow[1];
            deltaTPow[3] = deltaTPow[2] * deltaTPow[1];
            deltaTPowSIMD = wasm_v128_load(deltaTPow);

            {   // unroll for loop
                v128_t b = wasm_v128_load(fCenters + indexOffset + 0 * 4);
                v128_t prod = wasm_f32x4_mul(deltaTPowSIMD, b);
                wasm_v128_store(tempOut, prod);
                tmpCenters[0] = tempOut[0] + tempOut[1] + tempOut[2] + tempOut[3];

                b = wasm_v128_load(fCenters + indexOffset + 1 * 4);
                prod = wasm_f32x4_mul(deltaTPowSIMD, b);
                wasm_v128_store(tempOut, prod);
                tmpCenters[1] = tempOut[0] + tempOut[1] + tempOut[2] + tempOut[3];

                b = wasm_v128_load(fCenters + indexOffset + 2 * 4);
                prod = wasm_f32x4_mul(deltaTPowSIMD, b);
                wasm_v128_store(tempOut, prod);
                tmpCenters[2] = tempOut[0] + tempOut[1] + tempOut[2] + tempOut[3];
            }
            v128_t centerSIMD = wasm_v128_load(tmpCenters);
            v128_t distSIMD = wasm_f32x4_mul(mvpSIMD, centerSIMD);
            wasm_v128_store(tempOut, distSIMD);
            int distance = (int)(tempOut[0] + tempOut[1] + tempOut[2]);
            mappedDistances[i] = distance;
            if (distance > maxDistance) maxDistance = distance;
            if (distance < minDistance) minDistance = distance;
        }
#else
        float deltaTPow, deltaT;
        for (unsigned int i = sortStart; i < sortCount; i++) {
            unsigned int indexOffset = 13 * (unsigned int)indexes[i];
            deltaTPow = 1.0f;
            deltaT = timestamp - fCenters[indexOffset + 12];
            tmpCenters[0] = tmpCenters[1] = tmpCenters[2] = 0.0f;
            for (int j = 0; j < 4; j++) {
                tmpCenters[0] += fCenters[indexOffset + 0 + j] * deltaTPow;
                tmpCenters[1] += fCenters[indexOffset + 4 + j] * deltaTPow;
                tmpCenters[2] += fCenters[indexOffset + 8 + j] * deltaTPow;
                deltaTPow *= deltaT;
            }
            int distance = (int)(fMVPRow3[0] * tmpCenters[0] + fMVPRow3[1] * tmpCenters[1] + fMVPRow3[2] * tmpCenters[2]);
            mappedDistances[i] = distance;
            if (distance > maxDistance) maxDistance = distance;
            if (distance < minDistance) minDistance = distance;
        }
#endif
    }

    float distancesRange = (float)maxDistance - (float)minDistance;
    float rangeMap = (float)(distanceMapRange - 1) / distancesRange;

    for (unsigned int i = sortStart; i < sortCount; i++) {
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

    for (int i = (int)sortCount - 1; i >= (int)sortStart; i--) {
        unsigned int frequenciesIndex = mappedDistances[i];
        unsigned int freq = frequencies[frequenciesIndex];
        indexesOut[sortCount - freq] = indexes[i];
        frequencies[frequenciesIndex] = freq - 1;
    }
}
