#!/usr/bin/env py
"""
Image Processor for creating framed artwork and perspective mockups.

This script processes images to create:
1. Bordered print-ready images with fluorescent green borders (3900x5700 @ 300DPI)
2. Perspective-warped mockups blended onto template backgrounds

The script performs the following operations:
- Resizes and crops images to fit within specified borders
- Applies perspective transformations using custom coordinate mappings
- Uses multiply blend mode to composite images onto templates
- Generates multiple output variants for different display purposes

Required template files (must be in same directory as script):
- show.png: Primary template background
- show2.jpg: Secondary template background (different size)
- show3.png: Tertiary template background

Dependencies:
- Pillow (PIL): pip install Pillow
- numpy: pip install numpy

Usage: python image_processor.py <input_folder>
"""

import sys
import os
from PIL import Image
import numpy as np

# --- UTILITY FUNCTIONS ---

def resize_cover(img, target_w, target_h):
    """
    Resize the image keeping aspect ratio, ensuring the result
    fully covers the target area. Then center-crop to exactly
    target_w x target_h. (Used for the bordered image).
    """
    ow, oh = img.size
    scale_w = target_w / ow
    scale_h = target_h / oh
    scale = max(scale_w, scale_h)

    new_w = int(ow * scale)
    new_h = int(oh * scale)

    img_copy = img.copy() 
    img_copy = img_copy.resize((new_w, new_h), Image.LANCZOS) 

    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    right = left + target_w
    bottom = top + target_h

    return img_copy.crop((left, top, right, bottom))


def apply_multiply_blend(base_img, overlay_img):
    """
    Applies the Multiply blend mode (A * B / 255).
    """
    base_arr = np.array(base_img, dtype=float) / 255.0
    overlay_arr = np.array(overlay_img, dtype=float) / 255.0
    
    multiplied_arr = base_arr * overlay_arr
    
    final_arr = (multiplied_arr * 255).astype(np.uint8)
    return Image.fromarray(final_arr, 'RGB')


def find_perspective_coeffs(source_corners, dest_corners):
    """
    Calculates the 8 coefficients for a perspective transformation matrix
    using NumPy's linear algebra tools.
    """
    matrix = []
    # Create the linear system of equations
    for i in range(4):
        x, y = source_corners[2*i], source_corners[2*i + 1]
        X, Y = dest_corners[2*i], dest_corners[2*i + 1]
        
        matrix.append([x, y, 1, 0, 0, 0, -X*x, -X*y])
        matrix.append([0, 0, 0, x, y, 1, -Y*x, -Y*y])

    A = np.matrix(matrix, dtype=np.float64)
    B = np.array(dest_corners).reshape(8, 1)

    # Solve A * coeffs = B for coeffs
    coeffs = np.linalg.solve(A, B)
    return list(coeffs.flat)


def apply_perspective_transform(img, target_w, target_h, dest_corners):
    """
    Applies a perspective warp to the image, mapping its four corners 
    to the specific 8-point vector (dest_corners).
    """
    ow, oh = img.size
    
    # 1. Define the 4 corners of the source image (TL, TR, BR, BL)
    source_corners = (0, 0, ow, 0, ow, oh, 0, oh)
    
    # 2. Calculate the 8 coefficients using the NumPy solver
    try:
        # Note: dest_corners is used directly as the destination points
        coeffs = find_perspective_coeffs(source_corners, dest_corners)
    except np.linalg.LinAlgError:
        print("Error: Could not calculate perspective matrix. Check for impossible geometry.")
        return None

    # 3. Perform the transformation
    return img.transform(
        (target_w, target_h), 
        Image.PERSPECTIVE, 
        coeffs, 
        Image.BICUBIC, 
        fillcolor='white'
    )


def delete_file(filepath):
    """
    Safely delete a file if it exists.
    """
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
            print(f"[SUCCESS] Successfully deleted {filepath}")
        except OSError as e:
            # Handle cases like permission errors, etc.
            print(f"[ERROR] Error: {filepath} could not be deleted. {e}")
    else:
        print(f"[WARNING] File not found: {filepath}")


# --- TASK 1: CREATE BORDERED IMAGE ---
def create_bordered_image(fg_img, input_folder):
    """
    Creates a print-ready bordered image with fluorescent green borders.
    Outputs:
      - print.png: Full canvas with DPI settings (3900x5700)
      - output.png: Centered artwork without borders (for further processing)
    """
    bordered_output_path = os.path.join(input_folder, "print.png")
    output_path = os.path.join(input_folder, "output.png")
    
    # Canvas dimensions
    canvas_w, canvas_h = 3900, 5700
    canvas = Image.new("RGB", (canvas_w, canvas_h), "white")
    
    # First border (fluorescent green)
    box1_w, box1_h = 3660, 5460
    fluorescent_green = (57, 255, 20)
    box1 = Image.new("RGB", (box1_w, box1_h), fluorescent_green)
    box1_x = (canvas_w - box1_w) // 2
    box1_y = (canvas_h - box1_h) // 2
    canvas.paste(box1, (box1_x, box1_y))

    # Second border (image area)
    box2_w, box2_h = 3567, 5374
    img_final = resize_cover(fg_img, box2_w, box2_h) 

    box2_x = (canvas_w - box2_w) // 2
    box2_y = (canvas_h - box2_h) // 2

    canvas.paste(img_final, (box2_x, box2_y))
    
    # Save the centered artwork for further processing
    img_final.save(output_path, "PNG")
    
    # Save the full bordered canvas with DPI settings
    desired_dpi = (300, 300)
    canvas.save(bordered_output_path, "PNG", dpi=desired_dpi)
    
    print(f"[SUCCESS] Saved bordered image: {bordered_output_path}")
    print(f"[SUCCESS] Saved centered artwork: {output_path}")


# --- TASK 2: CREATE MULTIPLIED IMAGE ---
def create_multiplied_image(fg_img, show_image_path, output_path, dest_corners, resize_flag=None):
    """
    Creates a perspective-warped image blended onto a template background.
    
    Args:
        fg_img: PIL Image to warp and blend
        show_image_path: Path to background template image
        output_path: Where to save the result
        dest_corners: 8-point vector [x_tl, y_tl, x_tr, y_tr, x_br, y_br, x_bl, y_bl]
        resize_flag: If None or falsy, resize to 1071x1500; if truthy, resize to 393x654
    """
    
    # Resize foreground image based on flag
    if not resize_flag:
        fg_img = fg_img.resize((1071, 1500), Image.Resampling.LANCZOS)
    else:
        fg_img = fg_img.resize((393, 654), Image.Resampling.LANCZOS)
    
    # Load base template image
    base_img = Image.open(show_image_path).convert("RGB")
    base_w, base_h = base_img.size

    # Apply perspective transform to foreground image
    target_w = base_w
    target_h = base_h
    
    fg_perspectived = apply_perspective_transform(
        fg_img, 
        target_w, target_h, 
        dest_corners
    )
    
    if fg_perspectived is None:
        print(f"[ERROR] Failed to apply perspective transform for {output_path}")
        return False

    # Apply Multiply blend
    overlay_canvas = Image.new('RGB', (base_w, base_h), 'white') 
    overlay_canvas.paste(fg_perspectived, (0, 0)) 

    final_image = apply_multiply_blend(base_img, overlay_canvas)
    
    # Save result
    final_image.save(output_path, "PNG")
    print(f"[SUCCESS] Saved multiplied image: {output_path}")
    return True


# --- MAIN PROCESSING FUNCTION ---
def process_image(input_path, output_folder, script_dir):
    """
    Process a single image through the full pipeline.
    
    Args:
        input_path: Path to the input image file
        output_folder: Folder where output files will be saved
        script_dir: Directory containing template files
        
    Returns:
        Tuple of (success: bool, output_files: list, error_message: str)
    """
    # Define destination coordinates for perspective transformations
    # These coordinates map the image corners to specific positions on the templates
    # Format: [X_TL, Y_TL, X_TR, Y_TR, X_BR, Y_BR, X_BL, Y_BL]
    
    # Coordinates for show.png template
    DEST_COORDINATES = (
        -322, -320,   # Top-left
        650, -320,    # Top-right  
        670, 975,     # Bottom-right
        -370, 985     # Bottom-left
    )
    
    # Coordinates for show2.jpg template
    DEST_COORDINATES2 = (
        -196, -115,   # Top-left
        165, -178,    # Top-right
        170, 498,     # Bottom-right
        -195, 519     # Bottom-left
    )
    
    # Coordinates for show3.png template
    DEST_COORDINATES3 = (
        -415, -529,   # Top-left
        695, -519,    # Top-right
        718, 955,     # Bottom-right
        -495, 960     # Bottom-left
    )
    
    # Define template paths (relative to script directory)
    show_image_path = os.path.join(script_dir, "show.png")
    show_image_path2 = os.path.join(script_dir, "show2.jpg")
    show_image_path3 = os.path.join(script_dir, "show3.png")
    
    # Check if template files exist
    for template_path in [show_image_path, show_image_path2, show_image_path3]:
        if not os.path.exists(template_path):
            print(f"[ERROR] Missing template file: {template_path}")
            print("Please ensure show.png, show2.jpg, and show3.png are in the script directory.")
            return False, [], f"Missing template file: {template_path}"
    
    try:
        # Load and convert the input image
        fg_img = Image.open(input_path).convert('RGB')
        print(f"[INFO] Processing: {os.path.basename(input_path)}")
        
    except Exception as e:
        print(f"[ERROR] Error opening image {input_path}: {e}")
        return False, [], f"Error opening image: {e}"
    
    # --- TASK 1: Create bordered image ---
    create_bordered_image(fg_img, output_folder)
    
    # Load the centered artwork created in Task 1
    output_png_path = os.path.join(output_folder, "output.png")
    if not os.path.exists(output_png_path):
        print(f"[ERROR] Missing intermediate file: {output_png_path}")
        return False, [], f"Missing intermediate file: {output_png_path}"
    
    centered_artwork = Image.open(output_png_path).convert('RGB')
    
    # --- TASK 2: Create multiplied images for each template ---
    
    output_files = []
    
    # Template 1: show.png
    multiplied_output_path = os.path.join(output_folder, "show.png")
    if create_multiplied_image(
        centered_artwork, 
        show_image_path, 
        multiplied_output_path,
        DEST_COORDINATES
    ):
        output_files.append(multiplied_output_path)
    
    # Template 2: show2.jpg  
    multiplied_output_path = os.path.join(output_folder, "show2.png")
    if create_multiplied_image(
        centered_artwork, 
        show_image_path2, 
        multiplied_output_path,
        DEST_COORDINATES2,
        True  # Use different resize
    ):
        output_files.append(multiplied_output_path)
    
    # Template 3: show3.png
    multiplied_output_path = os.path.join(output_folder, "show3.png")
    if create_multiplied_image(
        centered_artwork, 
        show_image_path3, 
        multiplied_output_path,
        DEST_COORDINATES3
    ):
        output_files.append(multiplied_output_path)
    
    # Clean up intermediate file
    delete_file(output_png_path)
    
    # Also delete the print.png file? It's the bordered version
    # print_png_path = os.path.join(output_folder, "print.png")
    # delete_file(print_png_path)  # Uncomment if you don't want to keep the bordered version
    
    if len(output_files) > 0:
        return True, output_files, ""
    else:
        return False, [], "Failed to create any output images"


def main():
    """
    Main entry point for the script.
    Supports both file and folder input.
    """
    if len(sys.argv) != 2:
        print("Usage: python image_processor.py <input_path>")
        print("\nArguments:")
        print("  input_path    Path to an image file OR folder containing images")
        print("\nRequired template files in script directory:")
        print("  - show.png    Background template 1")
        print("  - show2.jpg   Background template 2")
        print("  - show3.png   Background template 3")
        return
    
    input_path = sys.argv[1]
    script_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    
    # Check if input is a file or directory
    if os.path.isfile(input_path):
        # Process single file
        input_folder = os.path.dirname(input_path)
        success, output_files, error_msg = process_image(input_path, input_folder, script_dir)
        
        if success:
            print(f"\n[SUCCESS] Successfully processed: {os.path.basename(input_path)}")
            print(f"[SUCCESS] Output files: {', '.join([os.path.basename(f) for f in output_files])}")
        else:
            print(f"\n[ERROR] Failed to process {os.path.basename(input_path)}: {error_msg}")
            
    elif os.path.isdir(input_path):
        # Process folder (first valid image only, maintains original behavior)
        input_folder = input_path
        valid_ext = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".avif")
        
        processed_count = 0
        for filename in os.listdir(input_folder):
            if filename.lower().endswith(valid_ext):
                file_path = os.path.join(input_folder, filename)
                
                success, output_files, error_msg = process_image(file_path, input_folder, script_dir)
                if success:
                    processed_count += 1
                    print(f"\n[SUCCESS] Successfully processed: {filename}")
                    print(f"[SUCCESS] Output files: {', '.join([os.path.basename(f) for f in output_files])}")
                else:
                    print(f"\n[ERROR] Failed to process {filename}: {error_msg}")
                
                # Process only one image (maintain original behavior)
                break
        
        if processed_count == 0:
            print("[ERROR] No valid image files found in the input folder.")
            print(f"   Supported formats: {', '.join(valid_ext)}")
            
    else:
        print(f"[ERROR] Input path does not exist: {input_path}")
        return
    
    print(f"\n[SUCCESS] Processing complete.")


if __name__ == "__main__":
    main()