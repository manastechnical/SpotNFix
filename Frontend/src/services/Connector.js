//This will create an axios instance so no need to create and call the axios functions everywhere just call the function and pass data to this Connector object.
import axios from 'axios';

export const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// API Connector Function
export const apiConnector = (method, url, bodyData, headers, params) => {
  console.log('API Connector: ', method, url, bodyData, headers, params);
  const accountData = JSON.parse(localStorage.getItem('account'));
    const adminToken = localStorage.getItem('adminToken');

  let token;

  if (accountData) {
    token = accountData.token;
  } else if (adminToken) {
    token = adminToken;
  }

  headers = headers || {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  console.log('byee');
  return axiosInstance({
    method,
    url,
    data: bodyData || null,
    headers,
    params: params || null,
  });
};
