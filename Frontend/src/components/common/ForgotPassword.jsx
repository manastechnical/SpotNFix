import React, { useState } from 'react';
import { authEndpoints } from '../../services/Apis';
import { apiConnector } from '../../services/Connector';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false); // 💡 New: Loading state

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        setLoading(true); // 💡 Start loading
        
        try {
            const response = await apiConnector('POST', authEndpoints.FORGOT_PASSWORD_API, { email });
            // Intuitive Feature: Clear the email input after a successful send
            setEmail(''); 
            setMessage(response.data.message || 'If an account exists, a password reset link has been sent to your email.');
            // Note: Use a generic success message to prevent user enumeration attacks
        } catch (err) {
            // Display a generic error message for security, unless your requirement dictates otherwise
            setError('Failed to process your request. Please check your email and try again later.'); 
        } finally {
            setLoading(false); // 💡 Stop loading
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4"> {/* Responsive padding and BG change */}
            <div className="w-full max-w-sm sm:max-w-md p-6 sm:p-8 space-y-6 bg-white rounded-xl shadow-2xl transition-all duration-300"> {/* Better shadow and rounded corners */}
                <h2 className="text-3xl font-extrabold text-center text-gray-800">Forgot Password</h2>
                <p className="text-center text-gray-500">Enter your email and we'll send you a link to reset your password.</p>
                
                {message && <p className="text-green-600 font-semibold text-center bg-green-100 p-3 rounded-lg border border-green-200">{message}</p>}
                {error && <p className="text-red-600 font-semibold text-center bg-red-100 p-3 rounded-lg border border-red-200">{error}</p>}
                
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            className="w-full px-4 py-3 mt-1 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150" // Improved styling
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading || !!message} // Disable during loading/success
                            required
                        />
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
                        {loading ? '🔄 Sending Link...' : 'Send Reset Link'} {/* 💡 Loading Feedback */}
                    </button>
                </form>
                
                <div className="text-center">
                    <Link to="/login" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition duration-150 flex items-center justify-center">
                        <span className="mr-2">←</span> Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;