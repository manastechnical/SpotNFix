import React from 'react';

const BoundingBoxOverlay = ({ 
  imageSrc, 
  detections = [], 
  imageStyle = {}, 
  className = "",
  showLabels = true,
  boxColor = '#ff0000',
  labelColor = '#ffffff',
  labelBgColor = '#000000'
}) => {
  if (!imageSrc || !detections || detections.length === 0) {
    return (
      <img 
        src={imageSrc} 
        alt="Pothole Preview" 
        style={imageStyle} 
        className={className}
      />
    );
  }

  const handleImageLoad = (event) => {
    const img = event.target;
    const container = img.parentElement;
    
    // Get actual image dimensions
    const imgRect = img.getBoundingClientRect();
    const scaleX = imgRect.width / img.naturalWidth;
    const scaleY = imgRect.height / img.naturalHeight;
    
    // Update bounding box positions
    const boxes = container.querySelectorAll('.bounding-box');
    boxes.forEach((box, index) => {
      if (detections[index]) {
        const detection = detections[index];
        const [x1, y1, x2, y2] = detection.bbox;
        
        // Scale coordinates to match displayed image size
        const scaledX1 = x1 * scaleX;
        const scaledY1 = y1 * scaleY;
        const scaledX2 = x2 * scaleX;
        const scaledY2 = y2 * scaleY;
        
        const width = scaledX2 - scaledX1;
        const height = scaledY2 - scaledY1;
        
        box.style.left = `${scaledX1}px`;
        box.style.top = `${scaledY1}px`;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;
        box.style.display = 'block';
      }
    });
  };

  return (
    <div className={`relative inline-block ${className}`} style={{ position: 'relative' }}>
      <img 
        src={imageSrc} 
        alt="Pothole Preview" 
        style={imageStyle} 
        onLoad={handleImageLoad}
        className="block"
      />
      
      {/* Render bounding boxes */}
      {detections.map((detection, index) => (
        <div
          key={index}
          className="bounding-box absolute border-2 hidden"
          style={{
            borderColor: boxColor,
            backgroundColor: 'transparent',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {showLabels && (
            <div
              className="absolute -top-6 left-0 px-1 py-0.5 text-xs font-semibold rounded"
              style={{
                backgroundColor: labelBgColor,
                color: labelColor,
                fontSize: '10px',
                lineHeight: '1',
                whiteSpace: 'nowrap',
                zIndex: 11,
              }}
            >
              Pothole {(detection.score * 100).toFixed(1)}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default BoundingBoxOverlay;

