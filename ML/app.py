from flask import Flask, request, jsonify
from flask_cors import CORS
import onnxruntime as ort
import numpy as np
import cv2
import os


def load_session(model_path: str) -> ort.InferenceSession:
    providers = [
        (
            'CUDAExecutionProvider',
            {
                'cudnn_conv_algo_search': 'HEURISTIC',
                'do_copy_in_default_stream': True,
            },
        ),
        'CPUExecutionProvider',
    ]
    try:
        session = ort.InferenceSession(model_path, providers=providers)
    except Exception:
        session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    return session


MODEL_PATH = os.path.join(os.path.dirname(__file__), 'best.onnx')
IMG_SIZE = 640

app = Flask(__name__)
# Allow calls from any origin by default; tighten in production via env
CORS(app)

session = load_session(MODEL_PATH)
input_name = session.get_inputs()[0].name
print(f"[ML] Model loaded from: {MODEL_PATH}")
print(f"[ML] Providers: {session.get_providers()}")
print(f"[ML] Input name: {input_name}, shape: {session.get_inputs()[0].shape}")


def letterbox(im: np.ndarray, new_shape=IMG_SIZE, color=(114, 114, 114)):
    shape = im.shape[:2]  # (h, w)
    if isinstance(new_shape, int):
        new_shape = (new_shape, new_shape)

    r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])
    new_unpad = (int(round(shape[1] * r)), int(round(shape[0] * r)))
    dw, dh = new_shape[1] - new_unpad[0], new_shape[0] - new_unpad[1]
    dw /= 2
    dh /= 2

    im = cv2.resize(im, new_unpad, interpolation=cv2.INTER_LINEAR)
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    im = cv2.copyMakeBorder(im, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)
    return im, r, (dw, dh)


def preprocess(image_bytes: bytes) -> tuple[np.ndarray, tuple[float, tuple[float, float]]]:
    file_bytes = np.frombuffer(image_bytes, np.uint8)
    img0 = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if img0 is None:
        raise ValueError('Invalid image data')

    img, r, (dw, dh) = letterbox(img0, IMG_SIZE)
    print(f"[ML] Original shape: {img0.shape}, resized: {img.shape}, r={r:.4f}, pad=({dw:.1f},{dh:.1f})")
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = img.astype(np.float32) / 255.0
    img = np.transpose(img, (2, 0, 1))  # HWC -> CHW
    img = np.expand_dims(img, axis=0)   # Add batch dim
    return img, (r, (dw, dh), img0.shape[:2])


def nms_boxes(boxes: np.ndarray, scores: np.ndarray, iou_threshold: float = 0.45) -> list[int]:
    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]

    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]

    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])

        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)

        inds = np.where(iou <= iou_threshold)[0]
        order = order[inds + 1]

    return keep


def postprocess(outputs, meta, conf_thres: float = 0.60, iou_thres: float = 0.45):
    r, (dw, dh), (h0, w0) = meta

    # Try built-in NMS outputs first: typical signatures are 1-4 outputs
    # Common: [num_dets, det_boxes, det_scores, det_classes]
    if isinstance(outputs, list) and len(outputs) in (3, 4):
        # Support shapes like: (1, max_dets, 4), (1, max_dets), (1, max_dets)
        if len(outputs) == 4:
            _, det_boxes, det_scores, det_classes = outputs
        else:
            det_boxes, det_scores, det_classes = outputs[0], outputs[1], outputs[2]
        try:
            print(f"[ML] Built-in NMS path: boxes={np.array(det_boxes).shape}, scores={np.array(det_scores).shape}, classes={np.array(det_classes).shape}")
        except Exception:
            pass
        det_boxes = np.squeeze(np.array(det_boxes))  # (N, 4) xyxy in resized space
        det_scores = np.squeeze(np.array(det_scores))
        det_classes = np.squeeze(np.array(det_classes)).astype(int)

        if det_boxes.ndim == 1:
            det_boxes = det_boxes.reshape(0, 4)

        # Map back to original image size
        # Undo padding and scaling
        def scale_coords(box):
            x1, y1, x2, y2 = box
            x1 -= dw
            y1 -= dh
            x2 -= dw
            y2 -= dh
            x1 /= r
            y1 /= r
            x2 /= r
            y2 /= r
            return [max(0, x1), max(0, y1), min(w0 - 1, x2), min(h0 - 1, y2)]

        boxes_out = [scale_coords(b) for b in det_boxes]
        results = []
        for b, s, c in zip(boxes_out, det_scores, det_classes):
            if s >= conf_thres:
                results.append({
                    'bbox': [float(b[0]), float(b[1]), float(b[2]), float(b[3])],
                    'score': float(s),
                    'class': int(c),
                })
        return results

    # Fallback: standard YOLO head output (batch, num, 85)
    preds = outputs[0]
    try:
        print(f"[ML] Raw output shape: {np.array(preds).shape}")
    except Exception:
        pass
    preds = np.squeeze(np.array(preds))  # (num, no)
    if preds.ndim != 2 or preds.shape[1] < 6:
        return []
    # Two possible formats:
    # 1) [x1, y1, x2, y2, score, class]
    # 2) [cx, cy, w, h, obj, cls_probs...]
    if preds.shape[1] == 6:
        boxes_xyxy = preds[:, 0:4].astype(np.float32)
        class_scores = preds[:, 4].astype(np.float32)
        class_ids = preds[:, 5].astype(np.int32)
        try:
            print(f"[ML] Parsed (xyxy,score,class) detections: total={len(preds)}")
        except Exception:
            pass
    else:
        boxes = preds[:, :4]
        scores = preds[:, 4]
        class_probs = preds[:, 5:]
        class_ids = np.argmax(class_probs, axis=1)
        class_scores = scores * class_probs[np.arange(class_probs.shape[0]), class_ids]
        # Convert from cx,cy,w,h to xyxy in resized space
        cx, cy, w, h = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
        x1 = cx - w / 2
        y1 = cy - h / 2
        x2 = cx + w / 2
        y2 = cy + h / 2
        boxes_xyxy = np.stack([x1, y1, x2, y2], axis=1)

    # Filter by conf
    mask = class_scores >= conf_thres
    boxes_xyxy = boxes_xyxy[mask]
    class_scores = class_scores[mask]
    class_ids = class_ids[mask]

    if boxes_xyxy.size == 0:
        return []

    keep = nms_boxes(boxes_xyxy, class_scores, iou_threshold=iou_thres)
    try:
        print(f"[ML] After conf filter: {len(class_scores)}; after NMS: {len(keep)}")
    except Exception:
        pass

    # Map back to original
    results = []
    for i in keep:
        x1, y1, x2, y2 = boxes_xyxy[i]
        # undo padding and scaling
        x1 -= dw
        y1 -= dh
        x2 -= dw
        y2 -= dh
        x1 /= r
        y1 /= r
        x2 /= r
        y2 /= r
        results.append({
            'bbox': [float(max(0, x1)), float(max(0, y1)), float(min(w0 - 1, x2)), float(min(h0 - 1, y2))],
            'score': float(class_scores[i]),
            'class': int(class_ids[i]),
        })
    return results


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


@app.route('/detect', methods=['POST'])
def detect():
    if 'image' not in request.files:
        return jsonify({'success': False, 'error': 'No image uploaded under field "image"'}), 400

    file = request.files['image']
    image_bytes = file.read()
    try:
        inp, meta = preprocess(image_bytes)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    outputs = session.run(None, {input_name: inp})
    dets = postprocess(outputs, meta)

    response = {
        'success': True,
        'detected': len(dets) > 0,
        'count': len(dets),
        'detections': dets,
    }
    return jsonify(response)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '5001'))
    app.run(host='0.0.0.0', port=port, debug=False)


