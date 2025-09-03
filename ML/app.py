from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
from PIL import Image
import io
import os


app = Flask(__name__)
CORS(app)


# Load YOLO model once at startup
MODEL_PATH = os.path.join(os.path.dirname(__file__), "best.pt")
model = YOLO(MODEL_PATH)


@app.route("/health", methods=["GET"]) 
def health_check():
    return jsonify({"status": "ok"})


@app.route("/detect", methods=["POST"]) 
def detect():
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request. Use form-data with key 'file'."}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    try:
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"Invalid image: {exc}"}), 400

    try:
        results = model(image)[0]
        names = results.names

        detections = []
        if results.boxes is not None and len(results.boxes) > 0:
            boxes = results.boxes
            xyxy = boxes.xyxy.cpu().tolist()
            conf = boxes.conf.cpu().tolist()
            cls = boxes.cls.cpu().tolist()

            for idx in range(len(xyxy)):
                x1, y1, x2, y2 = xyxy[idx]
                confidence = float(conf[idx])
                class_id = int(cls[idx])
                class_name = names.get(class_id, str(class_id)) if isinstance(names, dict) else (
                    names[class_id] if isinstance(names, (list, tuple)) and 0 <= class_id < len(names) else str(class_id)
                )

                detections.append(
                    {
                        "bbox": [x1, y1, x2, y2],
                        "confidence": confidence,
                        "class_id": class_id,
                        "class_name": class_name,
                    }
                )

        response = {
            "num_detections": len(detections),
            "detections": detections,
        }
        return jsonify(response)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"Inference error: {exc}"}), 500


if __name__ == "__main__":
    # Host 0.0.0.0 allows access from other devices (useful during development)
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)


