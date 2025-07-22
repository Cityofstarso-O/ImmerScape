import { Quaternion, Matrix3, Matrix4, DataUtils } from './external/three.module.js';

export class Utils {
    static DefaultSplatSortDistanceMapPrecision = 16;
    static MemoryPageSize = 65536;
    static BytesPerFloat = 4;
    static BytesPerInt = 4;
    static MaxScenes = 32;
    static ProgressiveLoadSectionSize = 262144;
    static ProgressiveLoadSectionDelayDuration = 15;
    static SphericalHarmonics8BitCompressionRange = 3;

    static f2fp162uint16 = DataUtils.toHalfFloat.bind(DataUtils);
    static uint162fp162f = DataUtils.fromHalfFloat.bind(DataUtils);

    static sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    static clamp(x, min, max) {
        return Math.max(Math.min(x, max), min);
    }

    // x is expected to be between [0, 1]
    static float2uint8(x, min = 0, max = 1) {
        return Utils.clamp(Math.round((x - min) / (max - min) * 255), 0, 255);
    }

    static uint82float(x, min = 0, max = 1) {
        return Utils.clamp(x, 0, 255) / 255 * (max - min) + min;
    }

    static packFloat2rgba(r, g, b, a, out, offset = 0) {
        out.setUint8(offset + 0, Utils.float2uint8(r));
        out.setUint8(offset + 1, Utils.float2uint8(g));
        out.setUint8(offset + 2, Utils.float2uint8(b));
        out.setUint8(offset + 3, Utils.float2uint8(a));
    }

    static computeCov3dPack2fp16 = function() {
        const tempMatrix4 = new Matrix4();
        const scaleMatrix = new Matrix3();
        const rotationMatrix = new Matrix3();
        const covarianceMatrix = new Matrix3();
        const transformedCovariance = new Matrix3();
        const transform3x3 = new Matrix3();
        const transform3x3Transpose = new Matrix3();

        return function(sx, sy, sz, rx, ry, rz, rw, out, offset = 0, transform = null) {
            tempMatrix4.makeScale(sx, sy, sz);
            scaleMatrix.setFromMatrix4(tempMatrix4);

            tempMatrix4.makeRotationFromQuaternion(new Quaternion(rx, ry, rz, rw).normalize());
            rotationMatrix.setFromMatrix4(tempMatrix4);

            covarianceMatrix.copy(rotationMatrix).multiply(scaleMatrix);
            transformedCovariance.copy(covarianceMatrix).transpose().premultiply(covarianceMatrix);

            if (transform) {
                transform3x3.setFromMatrix4(transform);
                transform3x3Transpose.copy(transform3x3).transpose();
                transformedCovariance.multiply(transform3x3Transpose);
                transformedCovariance.premultiply(transform3x3);
            }
            out.setUint16(offset +  0, Utils.f2fp162uint16(transformedCovariance.elements[0]), true);
            out.setUint16(offset +  2, Utils.f2fp162uint16(transformedCovariance.elements[3]), true);
            out.setUint16(offset +  4, Utils.f2fp162uint16(transformedCovariance.elements[6]), true);
            out.setUint16(offset +  6, Utils.f2fp162uint16(transformedCovariance.elements[4]), true);
            out.setUint16(offset +  8, Utils.f2fp162uint16(transformedCovariance.elements[7]), true);
            out.setUint16(offset + 10, Utils.f2fp162uint16(transformedCovariance.elements[8]), true);
        };

    }();

    static computeTexSize(texelNum) {
        const log2TexelNum = Math.max(Math.ceil(Math.log2(texelNum)), 0);
        if (log2TexelNum > 24) {
            console.warn(`texelNum ${texelNum} exceeds maximum 4096 * 4096 and was clamped to maximum`);
            log2TexelNum = 24;
        }
        if (log2TexelNum % 2 === 0) {
            const sideLength = Math.pow(2, log2TexelNum / 2);
            return { width: sideLength, height: sideLength };
        } else {
            const height = Math.pow(2, Math.floor(log2TexelNum / 2));
            const width = height * 2;
            return { width, height };
        }
    }

    static extractFileExtension(fileName) {
        return fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
    }
    
    static extractFileName(fileName) {
        const fileNameWithExtension = fileName.split('/').pop().split('\\').pop();
        const name = fileNameWithExtension.split('.').slice(0, -1).join('.');
        return name;
    }

    static isIOS() {
        const ua = navigator.userAgent;
        return ua.indexOf('iPhone') > 0 || ua.indexOf('iPad') > 0;
    }

    static getIOSSemever() {
        if (isIOS()) {
            const extract = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
            return new Semver(
                parseInt(extract[1] || 0, 10),
                parseInt(extract[2] || 0, 10),
                parseInt(extract[3] || 0, 10)
            );
        } else {
            return null; // or [0,0,0]
        }
    }

    /**
     * 综合检测当前设备是否为移动端。
     * 优先使用 navigator.userAgentData，其次是CSS媒体查询，最后回退到User Agent字符串。
     * @returns {boolean} 如果是移动设备则返回true，否则返回false。
     */
    static isMobile() {
        // 1. 优先使用最新的 User-Agent Client Hints API
        if (navigator.userAgentData) {
            return navigator.userAgentData.mobile;
        }

        // 2. 其次，使用CSS媒体查询的组合判断
        // 检查主要输入设备是否为手指，且不支持悬停
        const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
        const lacksHoverSupport = window.matchMedia('(hover: none)').matches;
        if (hasCoarsePointer && lacksHoverSupport) {
            return true;
        }

        // 检查是否有精密的指针（鼠标），如果有，则不太可能是手机
        const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
        if (hasFinePointer) {
            return false;
        }

        // 3. 作为最后的备用方案，使用传统的User Agent字符串检查
        // （虽然不完美，但能覆盖一些边缘情况）
        return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());
    }
}