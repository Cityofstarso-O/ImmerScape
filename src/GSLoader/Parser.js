import { GSLoader } from "./Loader.js";
import { ParserType, LoadType } from "../Global.js";

console.log('Worker: Parser.js module loaded successfully');

self.onmessage = (event) => {
    const message = event.data;
    let error = '';
    switch (message.type) {
        case LoadType.NATIVE:
            switch (message.parser) {
                case ParserType.CPU:
                    console.log(`worker: handle ${message.name} using cpu`);
                    const results = GSLoader.loadFromNative(message.name, message.data);
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