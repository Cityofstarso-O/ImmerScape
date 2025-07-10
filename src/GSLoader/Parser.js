import { ParserType, LoadType, FileType } from "../Global.js";
import { Utils } from "../Utils.js";
import { PlyLoader } from "./TypeLoader/PlyLoader.js";

console.log('Worker: Parser.js module loaded successfully');

/*return = {
    valid: Boolean,
    error: String,
    data: {
        xxx: {
            bytesPertexel: Number,
            buffer: ArrayBuffer,
        }
    },
};*/
const loadFromNative = function() {
    const map2FileType = {
        'ply': FileType.PLY,
        'spz': FileType.SPZ,
        'splat': FileType.SPLAT,
    }
    return function(name, content) {
        const extension = Utils.extractFileExtension(name);
        const fileType = map2FileType[extension] || FileType.NONE;
        switch (fileType) {
            case FileType.PLY:
                return PlyLoader.loadFromNative(content);
            default:
                return {
                    'valid': false,
                    'error': 'Unknown file extension: ' + extension,
                };
        }
            
    };
}();

self.onmessage = (event) => {
    const message = event.data;
    let error = '';
    switch (message.type) {
        case LoadType.NATIVE:
            switch (message.parser) {
                case ParserType.CPU:
                    console.log(`worker: handle ${message.name} using cpu`);
                    const results = loadFromNative(message.name, message.data);
                    if (results.valid) {
                        const transferables = Object.values(results.data).map(data => data.buffer);
                        self.postMessage({
                            'valid': results.valid,
                            'data': results.data,
                        }, transferables);
                        return;
                    }
                    error = results.error;
                    break;
                default:
                    error = 'Unknown parser type: ' + message.parser;
                    break;
            }
        case LoadType.URL:

            return;
        default:
            error = 'Unknown message type: ' + message.type;
            break;
    }
    self.postMessage({
        'valid': false,
        'error': error,
    });

};