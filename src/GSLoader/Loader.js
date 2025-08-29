import { ParserType, LoadType } from "../Global.js";
import { Utils } from "../Utils.js";
import * as THREE from "three";

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
                data.name = data.name || Utils.extractFileName(this.currentFile);
                data.uid = Utils.getRandomUID();
                data.transform = {
                    position: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 },
                    rotation: { x: 0, y: 0, z: 0 },
                };
                data.appliedTransform = data.appliedTransform ? new THREE.Matrix4().fromArray(data.appliedTransform) : new THREE.Matrix4();
                data.modelMatrix = data.appliedTransform.clone();
                data.appliedScale = data.appliedScale || 1.0;
                data.sceneScale = data.appliedScale;
                data.chunkBased = data.chunkBased || '';
                console.log(`[${(this.recvTime - this.sendTime)}ms]`);
                this.eventBus.emit('buffersReady', {
                    data: data,
                    sceneName: data.name,
                });
            } else {
                console.log(`[${(this.recvTime - this.sendTime)}ms] GSLoader ERROR: ${message.error}`);
                this.eventBus.emit('noteExternalListener', {
                    failLoad: true,
                    error: message.error,
                });
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
            this.noteExternalListener();
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
        this.noteExternalListener();
    }

    async readFileFromNative(file) {
        if (!this.currentFile) {
            this.currentFile = file.name;
			this.reader.readAsArrayBuffer(file);
		}
    }

    noteExternalListener(name) {
        this.eventBus.emit('noteExternalListener', {
            startLoad: true,
            name: name,
        });
    }

    static exportGlbFile(buffer, fileName) {
        // 1. 从 ArrayBuffer 创建一个 Blob
        const blob = new Blob([buffer], { type: 'model/gltf-binary' });

        // 2. 为 Blob 创建一个临时的 URL
        const url = URL.createObjectURL(blob);

        // 3. 创建一个隐藏的下载链接并配置它
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName; // 设置下载文件名
        
        // 4. 将链接添加到文档中，模拟点击，然后移除
        document.body.appendChild(a);
        a.click();
        
        // 5. 清理：等待片刻后移除链接并释放 URL
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
}