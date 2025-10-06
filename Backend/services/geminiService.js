import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCgUheaDVc1BRTc50a0E4J--h5w49bvLtU';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Detects pothole severity and type from an image using Gemini AI
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} imageType - MIME type of the image (e.g., 'image/jpeg')
 * @returns {Promise<{severity: string, type: string}>} - Object with severity level and pothole type
 */
export const detectPotholeSeverityAndType = async (imageBase64, imageType) => {
    try {
        const prompt = `
        Analyze this pothole image and provide two pieces of information:
        
        1. **Severity Level** - Consider these factors:
           - **Depth**: How deep is the pothole relative to the road surface?
           - **Size**: What is the diameter/width of the pothole?
           - **Damage**: How much structural damage is visible?
           - **Safety Risk**: What is the potential risk to vehicles and pedestrians?
           
           Classify severity as:
           - **High**: Very deep (>5cm), large diameter (>30cm), significant structural damage, high safety risk
           - **Medium**: Moderate depth (2-5cm), medium size (15-30cm), some structural damage, moderate safety risk
           - **Low**: Shallow (<2cm), small size (<15cm), minimal damage, low safety risk
        
        2. **Pothole Type** - Describe the type of pothole in 4-10 words. Consider:
           - Shape (circular, elongated, irregular)
           - Location (center lane, edge, intersection)
           - Cause (weather damage, heavy traffic, poor construction)
           - Characteristics (cracking, crumbling, deep hole)
           
           Examples: "Deep circular center lane hole", "Shallow edge erosion crack", "Irregular intersection damage"
        
        Respond in this EXACT format:
        SEVERITY: [High/Medium/Low]
        TYPE: [4-10 word description]
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
                maxOutputTokens: 50,
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

        const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        
        // Parse the response
        const parsed = parseSeverityAndTypeResponse(result);
        
        console.log(`[Gemini] Detected - Severity: ${parsed.severity}, Type: ${parsed.type}`);
        return parsed;

    } catch (error) {
        console.error('[Gemini] Error detecting severity and type:', error);
        
        // Fallback if API fails
        console.log('[Gemini] Falling back to Medium severity and default type due to API error');
        return {
            severity: 'Medium',
            type: 'Standard road damage'
        };
    }
};

/**
 * Detects pothole severity from an image using Gemini AI (legacy function for backward compatibility)
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} imageType - MIME type of the image (e.g., 'image/jpeg')
 * @returns {Promise<string>} - Severity level: 'High', 'Medium', or 'Low'
 */
export const detectPotholeSeverity = async (imageBase64, imageType) => {
    const result = await detectPotholeSeverityAndType(imageBase64, imageType);
    return result.severity;
};

/**
 * Parses the severity and type response from Gemini
 * @param {string} response - Raw response from Gemini
 * @returns {{severity: string, type: string}} - Parsed severity and type
 */
const parseSeverityAndTypeResponse = (response) => {
    if (!response) {
        return {
            severity: 'Medium',
            type: 'Standard road damage'
        };
    }

    try {
        const lines = response.split('\n').map(line => line.trim()).filter(line => line);
        let severity = 'Medium';
        let type = 'Standard road damage';

        for (const line of lines) {
            if (line.toLowerCase().startsWith('severity:')) {
                const severityMatch = line.match(/severity:\s*(high|medium|low)/i);
                if (severityMatch) {
                    severity = severityMatch[1].charAt(0).toUpperCase() + severityMatch[1].slice(1).toLowerCase();
                }
            } else if (line.toLowerCase().startsWith('type:')) {
                type = line.replace(/^type:\s*/i, '').trim();
                // Ensure type is between 4-10 words
                const words = type.split(/\s+/);
                if (words.length < 4) {
                    type = 'Standard road damage';
                } else if (words.length > 10) {
                    type = words.slice(0, 10).join(' ');
                }
            }
        }

        return { severity, type };
    } catch (error) {
        console.warn(`[Gemini] Error parsing response: ${response}, using defaults`);
        return {
            severity: 'Medium',
            type: 'Standard road damage'
        };
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
