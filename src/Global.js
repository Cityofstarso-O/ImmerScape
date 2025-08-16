export const ParserType = {
    'NONE': 0,
    'CPU': 1,
    'WASM': 2,
    'GPU': 3,
};

export const LoadType = {
    'NONE': 0,
    'NATIVE': 1,
    'URL': 2,
};

export const GSType = {
    'NONE': 0,
    'ThreeD': 1,
    'SPACETIME': 2,
};

export const FileType = {
    'NONE': 0,
    'PLY': 1,
    'SPLAT': 2,
    'SPZ': 3,
    'SPB': 4,
    'GLB':5,
};

export const GraphicsApiType = {
    'NONE': 0,
    'WEBGL': 1,
    'WEBGPU': 2,
};

// should not be used in worker
export class GlobalVars {
    static graphicsAPI = GraphicsApiType.NONE;
};