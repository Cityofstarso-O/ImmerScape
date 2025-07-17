import { GSLoader } from "./src/GSLoader/Loader.js";
import { EventBus } from "./src/EventBus.js";
import { GSScene } from "./src/GSScene.js";
import { WebGL } from "./src/backend/webgl.js";
import { ShaderManager } from "./src/ShaderManager.js";

async function main() {
    const canvas = document.querySelector('canvas');
    const webgl = new WebGL(canvas);
    const eventBus = new EventBus();
    const gsloader = new GSLoader(eventBus);
    const gsScene = new GSScene(eventBus, webgl);
    const shaderManager = new ShaderManager(eventBus, webgl);
}

main()