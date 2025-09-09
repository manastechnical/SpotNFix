//All the API endpoints will be declared here and then this will be used in entire frontend to access the endpoints...
const BaseURL = import.meta.env.VITE_API_BASE_URL;
export const MLBaseURL = import.meta.env.VITE_ML_BASE_URL || 'http://localhost:5001/';

export const authEndpoints = {
  LOGIN_API: BaseURL + 'api/auth/login',
  REGISTER: BaseURL + 'api/auth/register',
  VALIDATE_GMAIL: BaseURL + 'api/auth/validate',
  GOOGLE_SIGN_IN: BaseURL + 'api/auth/sign-in-google',
  REGISTER_CONTRACTOR: BaseURL + 'api/auth/register-contractor',
  REGISTER_GOVERNMENT_OFFICIAL: BaseURL + 'api/auth/register-government-official',
};

export const uploadEndPoints = {
  UPLOAD: BaseURL + 'api/upload/',
};

export const bidEndpoints = {
  SUBMIT_BID: BaseURL + 'api/bids/submit',
  ACCEPT_BID: BaseURL + 'api/bids/accept',
};

export const adminEndpoints = {
    ADMIN_LOGIN_API: BaseURL + 'api/admin/login',
    GET_PENDING_VERIFICATIONS_API: BaseURL + 'api/admin/pending-verifications',
    UPDATE_VERIFICATION_API: BaseURL + 'api/admin/update-verification',
};

export const potholeEndpoints = {
    VERIFY_POTHOLE: BaseURL + 'api/potholes/verify',    
    DISCARD_POTHOLE: BaseURL + 'api/potholes/discard', 
};

export const mlEndpoints = {
  DETECT: MLBaseURL + 'detect',
};