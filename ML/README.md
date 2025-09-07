# ML Detection Service

A lightweight Flask API that serves YOLOv8 pothole detection using the `best.pt` model.

## Setup

1. Create and activate a Python 3.10+ virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Ensure your model file exists at `ML/best.pt`.

## Run

```bash
python app.py
```

Server runs on `http://localhost:8000` by default. Set `PORT` to change.

## Endpoints

- GET /health → Health check
- POST /detect → Multipart form-data with key `file` (image). Returns JSON:

```json
{
  "num_detections": 1,
  "detections": [
    {
      "bbox": [x1, y1, x2, y2],
      "confidence": 0.92,
      "class_id": 0,
      "class_name": "pothole"
    }
  ]
}
```

## Example cURL

```bash
curl -X POST http://localhost:8000/detect \
  -H "Content-Type: multipart/form-data" \
  -F file=@sample.jpg
```

## Frontend usage (example)

```javascript
const formData = new FormData();
formData.append('file', file);
const res = await fetch('http://localhost:8000/detect', {
  method: 'POST',
  body: formData,
});
const data = await res.json();
```


