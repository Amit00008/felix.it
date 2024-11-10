import { useState } from 'react';

function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Send login request to backend
            const response = await fetch('http://localhost:4001/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            // Check if the response is OK
            if (!response.ok) {
                const errorData = await response.json();
                setError(errorData.message || 'Invalid login credentials. Please check your email and password.');
                setLoading(false);
                return;
            }

            const data = await response.json();

            // If token is returned, save it and call onLogin
            if (data.token) {
                localStorage.setItem('token', data.token); // Save token in localStorage
                onLogin(data.token); // Trigger login handler
                setEmail(''); // Reset email field
                setPassword(''); // Reset password field
            } else {
                setError('Invalid login credentials'); // If no token, show error
            }
        } catch (error) {
            console.error('Login failed:', error);
            setError('Login failed. Please try again.');
        } finally {
            setLoading(false); // Reset loading state
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {/* Display error message */}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {/* Email input */}
            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />

            {/* Password input */}
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />

            {/* Submit button */}
            <button type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
            </button>

            {/* Link to signup page */}
            <p>
                Don't have an account? <a href="/signup">SignUp</a>
            </p>
        </form>
    );
}

export default Login;
