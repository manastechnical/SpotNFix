//These repository files will be responsible for the flow of loaders and then sending the data to the connector along with the specific endpoint.
//i.e frontend pages will call the functions from thsese repo and then pass data to this and this function will decide the further actions/
//i.e enabling the loader, which endpoint should be called, after receiving the response what to do, toasting the required messages and at last defusing loaders.
import { toast } from 'react-hot-toast';
import { apiConnector } from '../Connector';
import {
  setAccount,
  setAccountAfterRegister,
  setDFeature,
} from '../../app/DashboardSlice';
import { authEndpoints, communityEndpoints } from '../Apis';
const { LOGIN_API, REGISTER, VALIDATE_GMAIL, GOOGLE_SIGN_IN, REGISTER_CONTRACTOR, REGISTER_GOVERNMENT_OFFICIAL } = authEndpoints;
const { GET_COMMUNITIES_API,
    CREATE_COMMUNITY_API,
    GET_COMMUNITY_BY_ID_API,
    JOIN_COMMUNITY_API,
    LEAVE_COMMUNITY_API,
    CREATE_EVENT_API, } = communityEndpoints;

export function login(email_id,role,password, navigate) {
  return async (dispatch) => {
    const loadingToast = toast.loading('Letting you in...');
    try {
      const response = await apiConnector('POST', LOGIN_API, {
        email_id,
        role,
        password,
      });

      console.log('Login API response : ', response);
      if (response.data.success) {
        toast.success('Login Successful..');
        const temp = {
          id: response.data.data.u_id,
          uname: response.data.data.name,
          uemail: response.data.data.email,
          // token: response.data.data.token,
          // role_id: response.data.data.role_id,
          role: response.data.data.role,
          is_new: response.data.data.isNew,
        };
        console.log("temp",temp);
        dispatch(setAccount(temp));
        if (response.data.data.isNew) {
          dispatch(
            setDFeature({
              dashboardFeature: 'Home',
            }),
          );
          navigate('/dashboard');
        } else {
          dispatch(
            setDFeature({
              dashboardFeature: 'Home',
            }),
          );
          navigate('/dashboard');
        }
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      console.log('Login API Error....', error);
      console.log('Login API Error....', error.response?.data?.message);

      toast.error(error.response?.data?.message);
    }
    toast.dismiss(loadingToast);
  };
}

export function authEmail(userId, otp, navigate) {
  return async (dispatch) => {
    const toastId = toast.loading('Validating OTP..');
    console.log('Validating OTP with data:', { userId, otp });
    try {
      const response = await apiConnector('POST', VALIDATE_GMAIL, {
        userId,
        otp,
      });
      console.log('Validate API response : ', response);
      if (response.data.success) {
        toast.success('Validation Successful..');
        navigate('/login');
        toast('Please Login...');
        console.log(response);
      } else {
        toast.error(response.data.message);
        throw new Error(response.data.message);
      }
    } catch (error) {
      console.log('VALIDATION API Error....', error);
      toast.error(error.response.data.message);
    }
    toast.dismiss(toastId);
  };
}

export function register(name, email_id, password, mobile, user_type, navigate) {
  return async (dispatch) => {
    const loadingToast = toast.loading('Registering you...');
    console.log('Registering user with data:', { name, email_id, password, mobile, user_type });
    try {
      const response = await apiConnector('POST', REGISTER, {
        name,
        email_id,
        mobile,
        password,
        user_type,
      });
      console.log('Register API response : ', response.data.data);
      if (response.data.success) {
        toast.success('Registration Successful..');
        const temp = {
          id: response.data.data.u_id,
          uname: response.data.data.name,
          uemail: response.data.data.email,
        };
        console.log(temp);
        dispatch(setAccountAfterRegister(temp));
        navigate('/verify-email');
      } else {
        if(response.status === 409) {
          toast.error('User already exists. Please login.');
        } else 
        throw new Error(response.data.message);
      }
    } catch (error) {
      console.log('Register API Error....', error);
      toast.error(error.response?.data?.message);
    }
    toast.dismiss(loadingToast);
  };
}

export function loginWithGoogle(credentialResponse, navigate) {
  return async (dispatch) => {
    const loadingToast = toast.loading('Signing in with Google...');
    try {
      const response = await apiConnector('POST', GOOGLE_SIGN_IN, {
        credential: credentialResponse.credential,
      });

      console.log('Google Sign-In API response: ', response);

      if (response.data.success) {
        toast.success('Google Sign-In Successful!');

        const temp = {
          id: response.data.data.u_id,
          uname: response.data.data.name,
          uemail: response.data.data.email,
          // token: response.data.data.data.token,
          is_new: response.data.data.isNew,
          role: response.data.data.role,
        };
        console.log(temp);

        dispatch(setAccount(temp));

        if (response.data.data.isNew) {
          dispatch(
            setDFeature({
              dashboardFeature: 'Home',
            }),
          );
          navigate('/dashboard');
        } else {
          dispatch(
            setDFeature({
              dashboardFeature: 'Home',
            }),
          );
          navigate('/dashboard');
        }
      } else {
        throw new Error(response.data.message || 'Sign-in failed');
      }
    } catch (error) {
      console.log('Google Sign-In API Error:', error);
      console.log(
        'Google Sign-In API Error Details:',
        error.response?.data?.message,
      );

      toast.error(
        error.response?.data?.message ||
          error.message ||
          'Failed to sign in with Google',
      );
    }

    toast.dismiss(loadingToast);
  };

}

export function registerContractor(formData, navigate) {
    return async (dispatch) => {
        const loadingToast = toast.loading('Registering contractor...');
        try {
            const response = await apiConnector('POST', REGISTER_CONTRACTOR, formData, {
                "Content-Type": "multipart/form-data",
            });

            console.log("CONTRACTOR REGISTRATION RESPONSE: ", response);

            if (response.data.success) {
                toast.success('Registration successful! Please check your email to verify your account.');
                // We need the user ID to pass to the verification page
                // Assuming the backend sends it back in the response
                const userId = response.data.data.u_id; 
                dispatch(setAccountAfterRegister({ id: userId }));
                navigate('/verify-email');
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            console.log('Contractor registration error:', error);
            toast.error(error.response?.data?.message || 'Registration failed');
        }
        toast.dismiss(loadingToast);
    };
}

export function registerGovernmentOfficial(formData, navigate) {
    return async (dispatch) => {
        const loadingToast = toast.loading('Registering government official...');
        try {
            const response = await apiConnector('POST', REGISTER_GOVERNMENT_OFFICIAL, formData, {
                "Content-Type": "multipart/form-data",
            });

            console.log("GOVT OFFICIAL REGISTRATION RESPONSE: ", response);

            if (response.data.success) {
                toast.success('Registration successful! Please check your email to verify your account.');
                const userId = response.data.data.u_id; 
                dispatch(setAccountAfterRegister({ id: userId }));
                navigate('/verify-email');
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            console.log('Government official registration error:', error);
            toast.error(error.response?.data?.message || 'Registration failed');
        }
        toast.dismiss(loadingToast);
    };
}

export const fetchAllCommunities = () => {
  return apiConnector('GET', GET_COMMUNITIES_API);
};

export const createNewCommunity = (communityData) => {
  // The second argument is the body, third is headers (if needed), fourth is params (if needed)
  return apiConnector('POST', CREATE_COMMUNITY_API, communityData);
};

export const fetchCommunityById = (id) => {
    return apiConnector('GET', GET_COMMUNITY_BY_ID_API + id);
};

export const joinCommunityById = (id, userId) => {
    return apiConnector('POST', JOIN_COMMUNITY_API(id), { userId });
};

export const leaveCommunityById = (id, userId) => {
    return apiConnector('POST', LEAVE_COMMUNITY_API(id), { userId });
};

export const createNewEvent = (id, eventData) => {
    return apiConnector('POST', CREATE_EVENT_API(id), eventData);
};

export const removeCommunityMember = async (communityId, memberId) => {
    const toastId = toast.loading("Removing member...");
    try {
        const response = await apiConnector('DELETE', communityEndpoints.REMOVE_MEMBER_API(communityId, memberId));
        toast.success("Member removed successfully!");
        return response;
    } catch (error) {
        toast.error(error.response?.data?.message || "Failed to remove member.");
        throw error;
    } finally {
        toast.dismiss(toastId);
    }
};

export const updateCommunityMemberRole = async (communityId, memberId, role) => {
    const toastId = toast.loading("Updating role...");
    try {
        const response = await apiConnector('PUT', communityEndpoints.UPDATE_MEMBER_ROLE_API(communityId, memberId), { role });
        toast.success("Role updated successfully!");
        return response;
    } catch (error) {
        toast.error(error.response?.data?.message || "Failed to update role.");
        throw error;
    } finally {
        toast.dismiss(toastId);
    }
};

export const updateCommunityDetails = async (id, details) => {
    const toastId = toast.loading("Updating...");
    try {
        const response = await apiConnector('PUT', communityEndpoints.UPDATE_COMMUNITY_API(id), details);
        toast.success("Community details saved!");
        return response;
    } catch (error) {
        toast.error(error.response?.data?.message || "Update failed.");
        throw error;
    } finally {
        toast.dismiss(toastId);
    }
};

export const deleteCommunityById = async (id) => {
    const toastId = toast.loading("Deleting community...");
    try {
        const response = await apiConnector('DELETE', communityEndpoints.DELETE_COMMUNITY_API(id));
        toast.success("Community deleted.");
        return response;
    } catch (error) {
        toast.error(error.response?.data?.message || "Deletion failed.");
        throw error;
    } finally {
        toast.dismiss(toastId);
    }
};

export const fetchCommunityEvents = async (communityId, token) => {
    return apiConnector("GET", communityEndpoints.GET_EVENTS_API(communityId), undefined, {
        'Authorization': `Bearer ${token}`
    });
};

export const createCommunityEvent = async (communityId, eventData, token) => {
    return apiConnector("POST", communityEndpoints.CREATE_EVENT_API(communityId), eventData, {
        'Authorization': `Bearer ${token}`
    });
};

export const updateCommunityEvent = async (eventId, eventData, token) => {
    return apiConnector("PUT", communityEndpoints.UPDATE_EVENT_API(eventId), eventData, {
        'Authorization': `Bearer ${token}`
    });
};

export const deleteCommunityEvent = async (eventId, token) => {
    return apiConnector("DELETE", communityEndpoints.DELETE_EVENT_API(eventId), undefined, {
        'Authorization': `Bearer ${token}`
    });
};

export const rsvpToEvent = async (eventId, data) => {
    return apiConnector("POST", communityEndpoints.RSVP_EVENT_API(eventId), data);
};