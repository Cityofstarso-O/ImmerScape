import { GSLoader } from "./src/GSLoader/Loader.js";
import { EventBus } from "./src/EventBus.js";
import { GSScene } from "./src/GSScene.js";

async function main() {
    const eventBus = new EventBus();
    const gsloader = new GSLoader(eventBus);
    const gsScene = new GSScene(eventBus);
}

main()