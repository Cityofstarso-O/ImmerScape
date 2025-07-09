import { ParserType, LoadType, FileType } from "../Global.js";
import { PlyLoader } from "./TypeLoader/PlyLoader.js";
import { EventBus } from "../EventBus.js";

export class GSLoader {
    constructor(eventBus) {
        this.eventBus = eventBus;
        {   // drag to load files
            const dropZone = document.getElementById('drop-zone');
		    dropZone.addEventListener('dragover', (event) => {
		    	event.preventDefault();
		    });
		    dropZone.addEventListener('drop', (event) => {
		    	event.preventDefault();
		    	const files = event.dataTransfer.files;
		    	if (!this.currentFile && files.length > 0) {
                    this.currentFile = files[0].name;
		    		this.reader.readAsArrayBuffer(files[0]);
		    	}
		    });
        }

        // we wanna use worker as a module so that we can import
        this.worker = new Worker(new URL('Parser.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (event) => {
            const message = event.data;
            this.recvTime = performance.now();
            if (message.valid) {
                const buffers = message.data;
                console.log(`[${(this.recvTime - this.sendTime)}ms] ${buffers}`);
                this.eventBus.emit('buffersReady', {
                    buffers: buffers,
                    sceneName: GSLoader.extractFileName(this.currentFile),
                });
            } else {
                console.log(`[${(this.recvTime - this.sendTime)}ms] GSLoader ERROR: ${message.error}`);
            }
            this.currentFile = '';
        };
        this.worker.onerror = (event) => {
            console.error('Worker error:', event.message);
            console.error('Filename:', event.filename);
            console.error('Line:', event.lineno);
            console.error('Error object:', event.error);
        };

        this.reader = new FileReader();
        this.reader.onload = (e) => {
            const content = e.target.result;
            console.log(`send file ${this.currentFile} to worker`);
            this.sendTime = performance.now();
            this.worker.postMessage({
                'type': LoadType.NATIVE,
                'parser': ParserType.CPU,
                'name': this.currentFile,
                'data': content,
            }, [content]);
        };

        this.currentFile = '';
        this.sendTime = 0;
        this.recvTime = 0;
    }

    static extractFileExtension(fileName) {
        return fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
    }
    static extractFileName(fileName) {
        const fileNameWithExtension = fileName.split('/').pop().split('\\').pop();
        const name = fileNameWithExtension.split('.').slice(0, -1).join('.');
        return name;
    }

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
    static loadFromNative = function() {
        const map2FileType = {
            'ply': FileType.PLY,
            'spz': FileType.SPZ,
            'splat': FileType.SPLAT,
        }

        return function(name, content) {
            const extension = GSLoader.extractFileExtension(name);
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
}