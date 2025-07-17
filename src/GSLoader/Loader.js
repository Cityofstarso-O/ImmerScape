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
                console.log(`[${(this.recvTime - this.sendTime)}ms] ${data}`);
                this.eventBus.emit('buffersReady', {
                    data: data,
                    sceneName: Utils.extractFileName(this.currentFile),
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
}