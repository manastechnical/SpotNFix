from flask import Flask, request, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

@app.route("/health", methods=["GET"]) 
def health_check():
    return jsonify({"status": "ok"})

@app.route("/detect", methods=["POST"]) 
def detect():
    print("[ML] Received request for /detect")
    
    if "file" not in request.files:
        print("[ML][WARN] 'file' missing in request.files")
        return jsonify({"error": "No file part in the request. Use form-data with key 'file'."}), 400

    file = request.files["file"]
    if file.filename == "":
        print("[ML][WARN] Empty filename received")
        return jsonify({"error": "No file selected."}), 400

    # For now, return a mock response to test the frontend integration
    response = {
        "num_detections": 1,
        "detections": [
            {
                "bbox": [100, 100, 200, 200],
                "confidence": 0.85,
                "class_id": 0,
                "class_name": "pothole",
            }
        ],
    }
    print(f"[ML] Mock response: {response}")
    return jsonify(response)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"[ML] Starting Flask app on port {port}")
    app.run(host="0.0.0.0", port=port, debug=True)
