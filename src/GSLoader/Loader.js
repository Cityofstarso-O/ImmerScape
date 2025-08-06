import { ParserType, LoadType } from "../Global.js";
import { Utils } from "../Utils.js";

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
                const data = message.data;
                const sceneName = Utils.extractFileName(this.currentFile);
                data.name = sceneName;
                data.uid = Utils.getRandomUID();
                console.log(`[${(this.recvTime - this.sendTime)}ms] ${data}`);
                this.eventBus.emit('buffersReady', {
                    data: data,
                    sceneName: sceneName,
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
                'quality': 'medium',
                'from': 'drag',
            }, [content]);
        };

        this.currentFile = '';  // not blank => is loading
        this.sendTime = 0;
        this.recvTime = 0;
    }

    /**
     * 从本地服务器异步读取文件。
     * @param {string} filePath - 相对于HTML文件的文件路径，例如 './shaders/vertex.glsl'。
     * @param {string} [type='text'] - 您期望的文件格式。可选值: 'text', 'json', 'blob', 'arrayBuffer'。
     * @returns {Promise<string|object|Blob|ArrayBuffer|null>} - 返回一个包含文件内容的Promise，如果失败则返回null。
     */
    async readFileFromServer(filePath) {
        this.currentFile = filePath;
        this.sendTime = performance.now();
        this.worker.postMessage({
            'type': LoadType.URL,
            'parser': ParserType.CPU,
            'name': this.currentFile,
            'data': null,
            'quality': 'medium',
            'from': 'url',
        });
    }

    async readFileFromNative(file) {
        if (!this.currentFile) {
            this.currentFile = file.name;
			this.reader.readAsArrayBuffer(file);
		}
    }
}