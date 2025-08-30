from scene import Scene
import argparse
import os

def convert(args):
    level, inputPath, outputPath, name = args.level, args.input, args.output, args.name
    quiet, visualize, reorder, saveJson = args.quiet, args.visualize, args.reorder, args.json

    if name == "":
        name, _ = os.path.splitext(os.path.basename(inputPath))
    if not (0 <= level <= 2):
        print(f"Error: compression level must be  0, 1 or 2")
        exit(1)
    if not os.path.exists(inputPath):
        print(f"Error: input file does not exist")
        exit(1)
    if outputPath is None:
        base_name, _ = os.path.splitext(inputPath)
        outputPath = base_name + ".glb"

    scene = Scene(inputPath, name)
    scene.reorder(reorder)
    if visualize:
        scene.visualize()
    if not quiet:
        scene.toGLB(outputPath, saveJson)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="convert between gs file formats",
        formatter_class=argparse.RawTextHelpFormatter # 保持帮助信息中的换行格式
    )

    parser.add_argument(
        "-i", "--input",
        dest="input",
        type=str,
        help="input file path"
    )
    
    parser.add_argument(
        "-o", "--output",
        dest="output",
        type=str,
        default=None,
        help="output file path"
    )

    parser.add_argument(
        "-n", "--name",
        dest="name",
        type=str,
        default="",
        help="scene name. \n\
            Default: file name from input path"
    )

    parser.add_argument(
        "-r", "--reorder",
        dest="reorder",
        type=str,
        default="Morton",
        help="reorder using 'Morton' or 'Hilbert' curve. \n\
            'Morton' is quick while 'Hilbert' might take a while but brings better quality\n\
            Default: Morton"
    )

    parser.add_argument(
        "-l", "--level",
        dest="level",
        type=int,
        choices=range(0, 4),
        default=0,
        help="[deprecated]\n\
            Compression Level:\n0: high quality\n1: medium quality\n2: low quality\n"
    )

    parser.add_argument(
        '-q', 
        '--quiet', 
        action='store_true', 
        help="do not output file"
    )

    parser.add_argument(
        '-v', 
        '--visualize', 
        action='store_true', 
        help="visualize point cloud"
    )

    parser.add_argument(
        '-j', 
        '--json', 
        action='store_true', 
        help="save json file about the gltf"
    )

    args = parser.parse_args()

    convert(args)