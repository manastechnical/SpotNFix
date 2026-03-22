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
  FORGOT_PASSWORD_API: BaseURL + 'api/auth/forgot-password',
  RESET_PASSWORD_API: BaseURL + 'api/auth/reset-password',

};

export const uploadEndPoints = {
  UPLOAD: BaseURL + 'api/upload/',
};

export const bidEndpoints = {
  SUBMIT_BID: BaseURL + 'api/bids/submit',
  ACCEPT_BID: BaseURL + 'api/bids/accept',
  SORT_BIDS: BaseURL + 'api/bids/sort',
};

export const adminEndpoints = {
  ADMIN_LOGIN_API: BaseURL + 'api/admin/login',
  GET_PENDING_VERIFICATIONS_API: BaseURL + 'api/admin/pending-verifications',
  UPDATE_VERIFICATION_API: BaseURL + 'api/admin/update-verification',
};

export const potholeEndpoints = {
  VERIFY_POTHOLE: BaseURL + 'api/potholes/verify',
  VERIFY_POTHOLE_WITH_SEVERITY: BaseURL + 'api/potholes/verify-with-severity',
  DISCARD_POTHOLE: BaseURL + 'api/potholes/discard',
  FINALIZE_REPAIR: "/api/potholes/finalize-repair",
  REJECT_REPAIR: "/api/potholes/reject-repair",
  DISCARD_REOPEN: BaseURL + 'api/potholes/reopen/discard',
  PENALIZE_REOPEN: BaseURL + 'api/potholes/reopen/penalize',
  RE_REPORT_DISCARDED: (potholeId) => BaseURL + `api/potholes/${potholeId}/re-report-discarded/`,
  DASHBOARD_STATUS_BY_SEVERITY: BaseURL + 'api/potholes/dashboard/status-by-severity'
};

export const dashboardEndpoints = {
  REPORTS_VS_RESOLUTIONS: BaseURL + 'api/potholes/dashboard/reports-vs-resolutions'
};

export const funnelEndpoints = {
  VERIFICATION_FUNNEL: BaseURL + 'api/potholes/dashboard/verification-funnel'
};

export const kpiEndpoints = {
  DASHBOARD_KPIS: BaseURL + 'api/potholes/dashboard/kpis'
};

export const mlEndpoints = {
  DETECT: MLBaseURL + 'detect',
};

export const severityEndpoints = {
  DETECT_SEVERITY: BaseURL + 'api/potholes/detect-severity',
};

export const contractorEndpoints = {
  COMPLETE_WORK_API: (bidId) => BaseURL + `api/contractor/complete-work/${bidId}`,
};

export const communityEndpoints = {
  GET_COMMUNITIES_API: BaseURL + `api/communities`,
  CREATE_COMMUNITY_API: BaseURL + `api/communities/create`,
  GET_COMMUNITY_BY_ID_API: BaseURL + `api/communities/`,
  JOIN_COMMUNITY_API: (id) => BaseURL + `api/communities/${id}/join`,
  LEAVE_COMMUNITY_API: (id) => BaseURL + `api/communities/${id}/leave`,
  CREATE_EVENT_API: (id) => BaseURL + `api/communities/${id}/events/create`,
  REMOVE_MEMBER_API: (communityId, memberId) => BaseURL + `api/communities/${communityId}/members/${memberId}`,
  UPDATE_MEMBER_ROLE_API: (communityId, memberId) => BaseURL + `api/communities/${communityId}/members/${memberId}/role`,
   UPDATE_COMMUNITY_API: (id) => BaseURL + `api/communities/${id}`,
  DELETE_COMMUNITY_API: (id) => BaseURL + `api/communities/${id}`,
  GET_EVENTS_API: (communityId) => BaseURL + `api/communities/${communityId}/events`,
  CREATE_EVENT_API: (communityId) => BaseURL + `api/communities/${communityId}/events`,
  UPDATE_EVENT_API: (eventId) => BaseURL + `api/communities/events/${eventId}`,
  DELETE_EVENT_API: (eventId) => BaseURL + `api/communities/events/${eventId}`,
  RSVP_EVENT_API: (eventId) => BaseURL + `api/communities/events/${eventId}/rsvp`,
};