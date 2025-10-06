import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCgUheaDVc1BRTc50a0E4J--h5w49bvLtU';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Detects pothole severity from an image using Gemini AI
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} imageType - MIME type of the image (e.g., 'image/jpeg')
 * @returns {Promise<string>} - Severity level: 'High', 'Medium', or 'Low'
 */
export const detectPotholeSeverity = async (imageBase64, imageType) => {
    try {
        const prompt = `
        Analyze this pothole image and determine the severity level. Consider the following factors:
        
        1. **Depth**: How deep is the pothole relative to the road surface?
        2. **Size**: What is the diameter/width of the pothole?
        3. **Damage**: How much structural damage is visible?
        4. **Safety Risk**: What is the potential risk to vehicles and pedestrians?
        
        Classify the severity as:
        - **High**: Very deep (>5cm), large diameter (>30cm), significant structural damage, high safety risk
        - **Medium**: Moderate depth (2-5cm), medium size (15-30cm), some structural damage, moderate safety risk
        - **Low**: Shallow (<2cm), small size (<15cm), minimal damage, low safety risk
        
        Respond with ONLY one word: High, Medium, or Low
        `;

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: prompt
                        },
                        {
                            inline_data: {
                                mime_type: imageType,
                                data: imageBase64
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.1,
                topK: 1,
                topP: 1,
                maxOutputTokens: 10,
                responseMimeType: "text/plain"
            }
        };

        const response = await axios.post(
            `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 30000 // 30 second timeout
            }
        );

        const severity = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        
        // Validate and normalize the response
        const normalizedSeverity = normalizeSeverity(severity);
        
        console.log(`[Gemini] Detected severity: ${normalizedSeverity} (original: ${severity})`);
        return normalizedSeverity;

    } catch (error) {
        console.error('[Gemini] Error detecting severity:', error);
        
        // Fallback to medium severity if API fails
        console.log('[Gemini] Falling back to Medium severity due to API error');
        return 'Medium';
    }
};

/**
 * Normalizes the severity response from Gemini
 * @param {string} severity - Raw severity response
 * @returns {string} - Normalized severity (High, Medium, or Low)
 */
const normalizeSeverity = (severity) => {
    if (!severity) return 'Medium';
    
    const normalized = severity.toLowerCase().trim();
    
    if (normalized.includes('high')) return 'High';
    if (normalized.includes('medium')) return 'Medium';
    if (normalized.includes('low')) return 'Low';
    
    // Default fallback
    console.warn(`[Gemini] Unknown severity response: ${severity}, defaulting to Medium`);
    return 'Medium';
};

/**
 * Converts image buffer to base64
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} mimeType - MIME type of the image
 * @returns {string} - Base64 encoded image
 */
export const imageBufferToBase64 = (imageBuffer, mimeType) => {
    return imageBuffer.toString('base64');
};
