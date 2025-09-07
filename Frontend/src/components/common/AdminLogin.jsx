import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setAdminToken } from '../../app/DashboardSlice';
import { apiConnector } from '../../services/Connector';
import { toast } from 'react-hot-toast';
import { adminEndpoints } from '../../services/Apis'; // Import admin endpoints

const AdminLogin = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const dispatch = useDispatch();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const loadingToast = toast.loading('Logging in...');
        try {
            const response = await apiConnector('POST', adminEndpoints.ADMIN_LOGIN_API, { username, password });
            if (response.data.success) {
                toast.success('Login successful!');
                dispatch(setAdminToken(response.data.token));
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Login failed');
        }
        toast.dismiss(loadingToast);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-800">
            <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
                <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
                    Super Admin Login
                </h2>
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label
                          htmlFor="username"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Username
                        </label>
                        <input
                          type="text"
                          id="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter username"
                          required
                        />
                    </div>
                     <div>
                        <label
                          htmlFor="password"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Password
                        </label>
                        <input
                          type="password"
                          id="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter password"
                          required
                        />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;