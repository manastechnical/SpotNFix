//All the API endpoints will be declared here and then this will be used in entire frontend to access the endpoints...
const BaseURL = import.meta.env.VITE_API_BASE_URL;

export const authEndpoints = {
  LOGIN_API: BaseURL + 'api/auth/login',
  REGISTER: BaseURL + 'api/auth/register',
  VALIDATE_GMAIL: BaseURL + 'api/auth/validate',
  GOOGLE_SIGN_IN: BaseURL + 'api/auth/sign-in-google',
};

export const uploadEndPoints = {
  UPLOAD: BaseURL + 'api/upload/',
};

export const bidEndpoints = {
  SUBMIT_BID: BaseURL + 'api/bids/submit',
};