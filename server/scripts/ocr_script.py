import sys
import json
import logging

# Suppress Paddle logs
logging.getLogger("ppocr").setLevel(logging.ERROR)

try:
    from paddleocr import PaddleOCR
except ImportError:
    print(json.dumps({"error": "paddleocr not installed. Please run: pip install paddlepaddle paddleocr"}))
    sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)

    image_path = sys.argv[1]

    # Initialize OCR. use_angle_cls=True for better orientation detection
    ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
    
    # Run OCR
    result = ocr.ocr(image_path, cls=True)

    # Extract just the text lines
    lines = []
    if result and result[0]:
        for line in result[0]:
            # line structure: [[ [x1,y1], [x2,y2]... ], ("text", confidence)]
            text = line[1][0]
            lines.append(text)

    print(json.dumps({"lines": lines}, ensure_ascii=False))

if __name__ == "__main__":
    main()