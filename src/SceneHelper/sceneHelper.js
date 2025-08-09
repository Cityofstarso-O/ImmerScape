import * as THREE from "three";
import { Gizmo } from "./gizmo.js";
import { Group } from "@tweenjs/tween.js";

export class SceneHelper {
    constructor(canvas, graphicsAPI) {
        this.canvas = canvas;
        this.graphicsAPI = graphicsAPI;

        this.gizmo = null;
        this.offsetY = 0.8;
        this.offsetX = 1 - this.canvas.clientHeight * (1 - this.offsetY) / this.canvas.clientWidth;
    }

    update(currentTime, deltaT) {
        this.gizmo.update(currentTime);
    }

    initGizmo(camera) {
        this.gizmo = new Gizmo(camera, this.graphicsAPI);
    }

    render() {
        this.graphicsAPI.enableDepth();
        this.graphicsAPI.updateViewport(
            {x: this.canvas.width * this.offsetX, y: this.canvas.height * this.offsetY}, 
            {x: this.canvas.width * (1 - this.offsetX), y: this.canvas.height * (1 - this.offsetY)}
        );
        this.gizmo.render();
    }

    _onMouseMove(event) {
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / this.canvas.clientWidth);
        mouse.y = 1 - (event.clientY / this.canvas.clientHeight);

        const gizmoMouse = new THREE.Vector2();
        gizmoMouse.x = (mouse.x - this.offsetX) / (1 - this.offsetX);
        gizmoMouse.y = (mouse.y - this.offsetY) / (1 - this.offsetY);

        this.gizmo.mouseMove(gizmoMouse);
    }

    _onAspectChanged() {
        this.offsetY = 0.8;
        this.offsetX = 1 - this.canvas.clientHeight * (1 - this.offsetY) / this.canvas.clientWidth;
    }

    _onMouseUp() {
        this.gizmo.mouseClick();
    }
}