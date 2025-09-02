import * as THREE from "three";
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

// --- 内联GLSL着色器代码, 方便XRScene自管理 ---
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
        this.gl = this.graphicsAPI.getContext(); // 获取原生WebGL上下文

        // 虚拟场景，用于数据管理
        this.virtualScene = new THREE.Scene();
        this.handModelFactory = new XRHandModelFactory();
        
        // 存储对 Three.js 对象的引用
        this.hands = [];
        this.handModels = [];

        // 存储提取出的、可供原生渲染使用的数据
        this.nativeRenderData = {
            left: null,
            right: null
        };
        
        // 存储原生WebGL资源
        this.skinningShaderProgram = null;
        this.shaderLocations = null;
        this.identityMatrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    }

    /**
     * @description 初始化手部模型。在XR会话成功启动后调用。
     * @param {XRManager} xrManager - 你自己的XR管理器实例
     */
    initialize(xrManager) {
        this.hands = [
            xrManager.getHand(0),
            xrManager.getHand(1)
        ];

        this.hands.forEach((hand, index) => {
            const handedness = (index === 0 ? 'left' : 'right');
            const handModel = this.handModelFactory.createHandModel(hand, 'mesh');
            handModel.userData.handedness = handedness;

            this.handModels.push(handModel);
            this.virtualScene.add(handModel); // 将模型添加到虚拟场景

            hand.addEventListener('connected', () => {
                const skinnedMesh = handModel.getObjectByProperty('type', 'SkinnedMesh');
                if (skinnedMesh && !this.nativeRenderData[handedness]) {
                    this._setupNativeWebGLResources(handedness, skinnedMesh);
                }
            });
        });
    }

    /**
     * @description 每帧调用，更新Three.js内部状态并提取渲染数据
     * @returns {Object} 包含左右手原生渲染所需数据的对象
     */
    updateRenderData() {
        if (this.handModels.length === 0) return null;

        for (const handModel of this.handModels) {
            const handedness = handModel.userData.handedness;
            const handData = this.nativeRenderData[handedness];
            
            // 只有当原生资源准备好之后才进行后续操作
            if (handData) {
                const skinnedMesh = handData.skinnedMesh; // 获取之前存储的引用
                
                if (skinnedMesh.visible) {
                    // 1. 触发骨架更新，计算最终的蒙皮矩阵
                    skinnedMesh.skeleton.update();
                    
                    // 2. 提取可以直接用于着色器的骨骼矩阵
                    handData.boneMatrices = skinnedMesh.skeleton.boneMatrices;
                    handData.visible = true;
                } else {
                    handData.visible = false;
                }
            }
        }

        return this.nativeRenderData;
    }

    /**
     * @description (私有) 提取几何体并创建原生WebGL资源 (VAO/VBO/EBO/Shader)
     * @param {string} handedness 
     * @param {THREE.SkinnedMesh} skinnedMesh 
     */
    _setupNativeWebGLResources(handedness, skinnedMesh) {
        const gl = this.gl;

        // 1. 编译和链接着色器 (如果尚未完成)
        if (!this.skinningShaderProgram) {
            const vs = this._createShader(gl, gl.VERTEX_SHADER, SKINNING_VERTEX_SHADER);
            const fs = this._createShader(gl, gl.FRAGMENT_SHADER, LIT_FRAGMENT_SHADER);
            this.skinningShaderProgram = this._createProgram(gl, vs, fs);
            this.shaderLocations = {
                attributes: {
                    position: 0, normal: 1, jointIndices: 2, jointWeights: 3,
                },
                uniforms: {
                    projectionMatrix: gl.getUniformLocation(this.skinningShaderProgram, 'u_projectionMatrix'),
                    viewMatrix: gl.getUniformLocation(this.skinningShaderProgram, 'u_viewMatrix'),
                    modelMatrix: gl.getUniformLocation(this.skinningShaderProgram, 'u_modelMatrix'),
                    jointMatrices: gl.getUniformLocation(this.skinningShaderProgram, 'u_jointMatrices'),
                    lightDirection: gl.getUniformLocation(this.skinningShaderProgram, 'u_lightDirection'),
                }
            };
        }

        // 2. 从 Three.js BufferGeometry 提取原始数据
        const geometry = skinnedMesh.geometry;
        const positions = geometry.attributes.position.array;
        const normals = geometry.attributes.normal.array;
        const skinIndices = geometry.attributes.skinIndex.array;
        const skinWeights = geometry.attributes.skinWeight.array;
        const indices = geometry.index.array;
        
        // 3. 创建并配置原生 VAO 和 VBOs/EBO
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        
        this._createAndBindBuffer(gl, gl.ARRAY_BUFFER, positions, this.shaderLocations.attributes.position, 3, gl.FLOAT);
        this._createAndBindBuffer(gl, gl.ARRAY_BUFFER, normals, this.shaderLocations.attributes.normal, 3, gl.FLOAT);
        this._createAndBindBuffer(gl, gl.ARRAY_BUFFER, skinWeights, this.shaderLocations.attributes.jointWeights, 4, gl.FLOAT);
        
        // 骨骼索引是整数 (uvec4)，需要特殊处理
        const skinIndexVbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, skinIndexVbo);
        gl.bufferData(gl.ARRAY_BUFFER, skinIndices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.shaderLocations.attributes.jointIndices);
        gl.vertexAttribIPointer(this.shaderLocations.attributes.jointIndices, 4, gl.UNSIGNED_BYTE, 0, 0); // 注意是 IPointer!

        const ebo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        // 4. 存储所有原生渲染所需的数据
        this.nativeRenderData[handedness] = {
            vao,
            indexCount: indices.length,
            skinnedMesh, // 保留对skinnedMesh的引用，以获取骨架
            boneMatrices: null,
            visible: false
        };
    }

    // --- (私有) WebGL 辅助函数 ---
	_createShader(gl, type, source) { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); return shader; }
	_createProgram(gl, vs, fs) { const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); return program; }
	_createAndBindBuffer(gl, target, data, location, size, type) { 
		const buffer = gl.createBuffer(); 
		gl.bindBuffer(target, buffer); 
		gl.bufferData(target, data, gl.STATIC_DRAW); 
		gl.enableVertexAttribArray(location); 
		gl.vertexAttribPointer(location, size, type, false, 0, 0); }
}