import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authEndpoints } from '../../services/Apis';
import { apiConnector } from '../../services/Connector';

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false); // 💡 New: Loading state
    const [showPassword, setShowPassword] = useState(false); // 💡 New: Toggle state

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setError('');
        setMessage('');
        setLoading(true); // 💡 Start loading

        try {
            const response = await apiConnector('POST', `${authEndpoints.RESET_PASSWORD_API}/${token}`, { password });
            setMessage(response.data.message);
            
            // 💡 Intuitive Feature: Clear passwords on successful reset
            setPassword('');
            setConfirmPassword('');

            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reset password. Please try again or request a new link.');
        } finally {
            setLoading(false); // 💡 Stop loading
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4"> {/* Responsive padding and BG change */}
            <div className="w-full max-w-sm sm:max-w-md p-6 sm:p-8 space-y-6 bg-white rounded-xl shadow-2xl transition-all duration-300"> {/* Better shadow and rounded corners */}
                <h2 className="text-3xl font-extrabold text-center text-gray-800">New Password</h2>
                
                {message && <p className="text-green-600 font-semibold text-center bg-green-100 p-3 rounded-lg border border-green-200">{message} Redirecting...</p>}
                {error && <p className="text-red-600 font-semibold text-center bg-red-100 p-3 rounded-lg border border-red-200">{error}</p>}
                
                <form className="space-y-6" onSubmit={handleSubmit}>
                    
                    {/* New Password Field */}
                    <div>
                        <label htmlFor="password" className="text-sm font-medium text-gray-700">New Password</label>
                        <div className="relative mt-1">
                            <input
                                type={showPassword ? "text" : "password"} // 💡 Show/Hide logic
                                id="password"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 pr-10" // Improved styling
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading || !!message} // Disable during loading/success
                                required
                            />
                             <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>
                    
                    {/* Confirm Password Field */}
                    <div>
                        <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm New Password</label>
                        <div className="relative mt-1">
                            <input
                                type={showPassword ? "text" : "password"} // 💡 Show/Hide logic
                                id="confirmPassword"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 pr-10" // Improved styling
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={loading || !!message} // Disable during loading/success
                                required
                            />
                            {/* Reusing the same toggle button for consistency, though it's optional here */}
                             <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>
                    
                    {/* Submit Button with Loading State */}
                    <button 
                        type="submit" 
                        className={`w-full py-3 font-semibold rounded-lg transition duration-150 ${
                            loading 
                                ? 'bg-blue-400 cursor-not-allowed flex items-center justify-center' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                        disabled={loading || !!message}
                    >
                        {loading ? '🔄 Resetting...' : 'Reset Password'} {/* 💡 Loading Feedback */}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;