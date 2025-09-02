import * as THREE from "three";
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

const SKINNING_VERTEX_SHADER = `#version 300 es
#define MAX_JOINTS 64
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in uvec4 a_joint_indices;
layout(location = 3) in vec4 a_joint_weights;
uniform mat4 u_projectionMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_modelMatrix;
uniform mat4 u_jointMatrices[MAX_JOINTS];
out vec3 v_normal;
void main() {
    mat4 skinMatrix = a_joint_weights.x * u_jointMatrices[a_joint_indices.x] + a_joint_weights.y * u_jointMatrices[a_joint_indices.y] + a_joint_weights.z * u_jointMatrices[a_joint_indices.z] + a_joint_weights.w * u_jointMatrices[a_joint_indices.w];
    vec4 skinnedPosition = skinMatrix * vec4(a_position, 1.0);
    gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * skinnedPosition;
    mat4 normalMatrix = transpose(inverse(u_modelMatrix * skinMatrix));
    v_normal = normalize((normalMatrix * vec4(a_normal, 0.0)).xyz);
}`;

const LIT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 v_normal;
uniform vec3 u_lightDirection;
out vec4 outColor;
void main() {
    vec3 normal = normalize(v_normal);
    float lightIntensity = max(dot(normal, normalize(u_lightDirection)), 0.0);
    vec3 baseColor = vec3(0.8, 0.8, 0.8);
    vec3 ambient = vec3(0.2);
    vec3 finalColor = ambient + baseColor * lightIntensity;
    outColor = vec4(finalColor, 1.0);
}`;

export class XRScene {
    constructor(graphicsAPI) {
        this.graphicsAPI = graphicsAPI;

        this.virtualScene = new THREE.Scene();
        this.hands = [];
        this.handModels = [];
        this.handRenderData = {};

        // webgl
        this.skinningShaderProgram = null;
        this.shaderLocations = null;
        this.identityMatrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    }

    addHand(handGroup, index) {
        this.hands[index] = handGroup;
        this.virtualScene.add(handGroup);

        const factory = new XRHandModelFactory();
        const handModel = factory.createHandModel(handGroup, 'mesh');
        this.handModels[index] = handModel;
        this.virtualScene.add(handModel);

        hand.addEventListener('connected', (event) => {
            const handedness = event.inputSource.handedness;
            handModel.userData.handedness = handedness;

            const skinnedMesh = handModel.getObjectByProperty('type', 'SkinnedMesh');
            if (skinnedMesh && !this.handRenderData[handedness]) {
                this.setupNativeWebGLResources(handedness, skinnedMesh);
            }
        });
    }
    
    addController( index ) {
    }

    addControllerGrip( index ) {
    }

    setupNativeWebGLResources(handedness, skinnedMesh) {
        if (!this.skinningShaderProgram) {
            this.skinningShaderProgram = this.graphicsAPI.setupProgram(SKINNING_VERTEX_SHADER, LIT_FRAGMENT_SHADER);
            this.shaderLocations = {
                attributes: this.graphicsAPI.getAttrib(),
                uniforms: this.graphicsAPI.getUniform(),
            };
        }

        const geometry = skinnedMesh.geometry;
        const positions = geometry.attributes.position.array;
        const normals = geometry.attributes.normal.array;
        const skinIndices = geometry.attributes.skinIndex.array;
        const skinWeights = geometry.attributes.skinWeight.array;
        const indices = geometry.index.array;
        
        const gl = this.graphicsAPI.getContext();
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        
        this.graphicsAPI.createAndBindBuffer(gl.ARRAY_BUFFER, positions, this.shaderLocations.attributes.position, 3, gl.FLOAT);
        this.graphicsAPI.createAndBindBuffer(gl.ARRAY_BUFFER, normals, this.shaderLocations.attributes.normal, 3, gl.FLOAT);
        this.graphicsAPI.createAndBindBuffer(gl.ARRAY_BUFFER, skinWeights, this.shaderLocations.attributes.jointWeights, 4, gl.FLOAT);
        
        const skinIndexVbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, skinIndexVbo);
        gl.bufferData(gl.ARRAY_BUFFER, skinIndices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.shaderLocations.attributes.jointIndices);
        gl.vertexAttribIPointer(this.shaderLocations.attributes.jointIndices, 4, gl.UNSIGNED_BYTE, 0, 0); // 注意是 IPointer!

        const ebo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        this.handRenderData[handedness] = {
            vao,
            indexCount: indices.length,
            skinnedMesh,
            boneMatrices: null,
            visible: false
        };
    }

    updateRenderData() {
        for (const handModel of this.handModels) {
            const handedness = handModel.userData.handedness;
            
            if (handedness) {
                const handData = this.handRenderData[handedness];
                const skinnedMesh = handData.skinnedMesh;
                
                if (skinnedMesh.visible) {
                    skinnedMesh.skeleton.update();
                    
                    handData.boneMatrices = skinnedMesh.skeleton.boneMatrices;
                    handData.visible = true;
                } else {
                    handData.visible = false;
                }
            }
        }
    }

    renderHands(view) {
        const uniformsLoc = this.shaderLocations.uniforms;
        for (const handData of Object.values(this.handRenderData)) {
            if (handData && handData.visible) {
                this.graphicsAPI.updateProgram(this.skinningShaderProgram);
                this.graphicsAPI.updateVertexInput(handData.vao);
                
                this.graphicsAPI.updateUniform(uniformsLoc.projectionMatrix, 'Matrix4fv', view.projectionMatrix, false);
                this.graphicsAPI.updateUniform(uniformsLoc.viewMatrix, 'Matrix4fv', view.transform.inverse.matrix, false);
                this.graphicsAPI.updateUniform(uniformsLoc.modelMatrix, 'Matrix4fv', this.identityMatrix, false);
                this.graphicsAPI.updateUniform(uniformsLoc.jointMatrices, 'Matrix4fv', handData.boneMatrices, false);
                this.graphicsAPI.updateUniform(uniformsLoc.lightDirection, '3f', [0.5, 1.0, 0.5]);
                // TODO
                gl.drawElements(gl.TRIANGLES, handData.indexCount, gl.UNSIGNED_SHORT, 0);
            }
        }
        this.graphicsAPI.updateVertexInput(null);
    }
}