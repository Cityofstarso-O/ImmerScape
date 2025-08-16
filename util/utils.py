import numpy as np
import math
import warnings
import colorsys
import time
import pyvista as pv
from scipy.spatial.distance import pdist


def packRGBA2u32(colors: np.ndarray) -> np.ndarray:
    shape0 = colors.shape[0]
    if colors.shape[1] != 4 or colors.dtype != np.float32:
        raise ValueError("输入数组的形状必须是 (num, 4) 且类型为 float32")

    colors = np.round(colors * 255.0).astype(np.uint8)
    packed_colors = colors.copy().view(dtype=np.uint32)
    return packed_colors.reshape([shape0, 1])

def sigmoid(x: np.ndarray):
    return 1 / (1 + np.exp(-x))

def padBack(x: np.ndarray, num = 1):
    return np.pad(x, ((0, 0), (0, num)), mode='constant', constant_values=0)

def uint8Quantify(x: np.ndarray, min, max):
    return np.clip(np.round((x - min) / (max - min) * 255), 0, 255).astype(np.uint8)

def alignUp(x, alignment):
    return ((x + alignment - 1) // alignment) * alignment

def compute_tex_size(texel_num: int, chunkBased: bool) -> tuple:
    # we wanna pad as less as possible
    # for general usage, width and height are limited to 4096
    if texel_num <= 0:
        return 0, 0

    max_height = max_width = 4096 // 16 if chunkBased else 4096

    if texel_num > max_height * max_width:
        raise ValueError("point num is too large! Should be less or equal to 4096 * 4096!")
    
    # suppose we have i columns of max_height
    for i in range(1, max_width + 1):
        if texel_num <= i * max_height:
            return i, alignUp(texel_num, i) // i

    return 0, 0
    
def alignTo256(ply: np.ndarray, alignment: int = 256) -> np.ndarray:
    num_vertices = ply.shape[0]
    num_to_pad = (alignment - (num_vertices % alignment)) % alignment
    if num_to_pad > 0:
        last_vertex = ply[-1]
        padding_array = np.tile(last_vertex, (num_to_pad, 1))
        return np.concatenate((ply, padding_array), axis=0)
    else:
        return ply

def create_block_colors_high_contrast(n_points: int, block_size: int = 256) -> np.ndarray:
    """
    使用黄金比例配色法为点云创建高对比度的分块颜色。

    Args:
        n_points: 点的总数。
        block_size: 每个颜色块的大小。

    Returns:
        一个形状为 (n_points, 3) 的 uint8 RGB 颜色数组。
    """
    
    # --- 步骤 1: 使用黄金比例生成高对比度的调色板 ---
    num_blocks = (n_points + block_size - 1) // block_size
    
    # 黄金比例的共轭数
    GOLDEN_RATIO_CONJUGATE = (np.sqrt(5) - 1) / 2
    
    # 初始化一个随机的起始色相
    hue = np.random.rand()
    
    palette_rgb_float = []
    for _ in range(num_blocks):
        # 递增色相
        hue = (hue + GOLDEN_RATIO_CONJUGATE) % 1.0
        
        # 将HSV颜色转换为RGB颜色。
        # 我们保持饱和度(S)和亮度(V)较高，以获得鲜艳的颜色
        saturation = 0.85
        value = 0.9
        rgb_float = colorsys.hsv_to_rgb(hue, saturation, value)
        palette_rgb_float.append(rgb_float)
    
    # 将 [0, 1] 范围的浮点数颜色转换为 [0, 255] 的 uint8 格式
    palette_uint8 = (np.array(palette_rgb_float) * 255).astype(np.uint8)
    
    # --- 步骤 2: 将颜色分配给每个点 ---
    # 这部分逻辑和之前一样
    block_indices = np.arange(n_points) // block_size
    colors = palette_uint8[block_indices]

    return colors

# --- ✅ 新的分析函数 ---
def analyze_point_blocks(points: np.ndarray, block_size: int = 256):
    """
    分析已分组的点云，统计组内的距离特性。

    Args:
        points: 已排序和分组的点云，形状为 (N, 3)。
        block_size: 每个分组的大小。
    """
    start_time = time.time()
    
    n_points = len(points)
    num_blocks = (n_points + block_size - 1) // block_size
    
    threshold_distance = np.sqrt(3)
    
    # 用于存储每个块的最大内部距离
    all_max_distances = []
    
    # 遍历每个块
    for i in range(num_blocks):
        start_idx = i * block_size
        end_idx = min((i + 1) * block_size, n_points)
        
        current_block = points[start_idx:end_idx]
        
        # 如果块内少于2个点，则无法计算距离
        if len(current_block) < 2:
            all_max_distances.append(0)
            continue
        
        # 使用 pdist 高效计算块内所有点对的距离
        # pdist 返回一个压缩后的一维距离矩阵
        pairwise_distances = pdist(current_block, metric='euclidean')
        
        # 找到这个块内的最大距离
        max_dist_in_block = np.max(pairwise_distances)
        all_max_distances.append(max_dist_in_block)

    all_max_distances = np.array(all_max_distances)
    
    # --- 开始统计 ---
    # 1. 有多少个组
    total_blocks_found = len(all_max_distances)
    
    # 2. 组内最大距离小于 sqrt(3) 的组的数量和百分比
    compact_blocks_count = np.sum(all_max_distances < threshold_distance)
    percentage_compact = (compact_blocks_count / total_blocks_found) * 100 if total_blocks_found > 0 else 0
    
    # 3. 组内最大距离的最大值
    overall_max_distance = np.max(all_max_distances) if total_blocks_found > 0 else 0
    
    analysis_time = time.time() - start_time
    print(f"Analysis done, using {analysis_time:.2f}s")
    print("-" * 25)
    print(f"point num: {n_points:,}")
    print(f"chunk size: {block_size}")
    print(f"chunk num: {total_blocks_found}")
    print("-" * 25)
    print(f"compact threshold: sqrt(3) ≈ {threshold_distance:.4f}")
    print(f"compact chunk num: {compact_blocks_count} / {total_blocks_found}")
    print(f"compact chunk percentage: {percentage_compact:.2f}%")
    print("-" * 25)
    print(f"max radius of chunk: {overall_max_distance:.4f}\n")

def visualize_with_pyvista(points: np.ndarray):
    """
    Visualizes the point cloud in a native PyVista window,
    with support for custom colors and a specific camera view.

    Args:
        points: The (N, 3) NumPy array of XYZ coordinates.
        colors: (Optional) The (N, 3) NumPy array of RGB colors (uint8, 0-255).
    """
    print("Creating visualization with PyVista...")
    colors = create_block_colors_high_contrast(points.shape[0], 256)

    # 1. Convert the NumPy array into a PyVista PolyData object.
    cloud = pv.PolyData(points)
    
    # 3. Create a plotter object.
    plotter = pv.Plotter(window_size=[1280, 720])
    pv.set_plot_theme("dark")

    # 4. Add the point cloud to the plotter.
    # We check if custom colors were provided.
    # --- Using Custom RGB Colors ---
    print("Using custom RGB colors for visualization.")
    plotter.add_mesh(
        cloud,
        scalars=colors,  # Pass the (N, 3) color array here
        rgb=True,        # IMPORTANT: Tell PyVista these are RGB colors
        point_size=5,
        render_points_as_spheres=True
    )
    
    # 5. Customize the scene and controls.
    plotter.show_axes()

    # 6. ✅ Set the camera position BEFORE showing the plot.
    # The format is: [(position), (focal_point), (view_up)]
    camera_position = [(0, 0, -10), (0, 0, 0), (0, -1, 0)]
    plotter.camera_position = camera_position

    # 7. Display the interactive rendering window.
    print("\nDisplaying plot window. Press 'q' to close.")
    plotter.show()