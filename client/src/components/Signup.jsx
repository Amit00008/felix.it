import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Auth.css';

function Signup({ onSignup }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (data.token) {
                localStorage.setItem('token', data.token);
                onSignup(data.token);
                setEmail('');
                setPassword('');
                setConfirmPassword('');
            } else {
                setError('Signup failed. Please try again.');
            }
        } catch (err) {
            console.error('Signup failed:', err);
            setError('Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-grid">
                <aside className="auth-showcase" aria-hidden="true">
                    <div className="auth-showcase-window">
                        <div className="auth-window-bar">
                            <span />
                            <span />
                            <span />
                            <p>felix.it / onboarding</p>
                        </div>

                        <div className="auth-window-body">
                            <div className="auth-code-line"><span>1</span><code>const user = await auth.createAccount(email, password);</code></div>
                            <div className="auth-code-line"><span>2</span><code>const template = await setupStarterWorkspace(user.id);</code></div>
                            <div className="auth-code-line"><span>3</span><code>openWorkspace(template.name);</code></div>
                            <div className="auth-code-line"><span>4</span><code>showToast("Ready to ship");</code></div>
                        </div>
                    </div>

                    <div className="auth-showcase-copy">
                        <h3>Start with an IDE mindset.</h3>
                        <p>Create your account and get a workspace that already feels familiar.</p>
                    </div>

                    <ul className="auth-showcase-list">
                        <li>Opinionated dev-first defaults</li>
                        <li>Project dashboard with quick actions</li>
                        <li>Workspace-ready in seconds</li>
                    </ul>
                </aside>

                <div className="auth-card">
                    <div className="auth-header">
                        <div className="auth-brand">
                            <div className="auth-brand-icon">F</div>
                            <span className="auth-brand-name">
                                Felix<span className="brand-dot">.</span>it
                            </span>
                        </div>
                        <p className="auth-tagline">Developer workspace</p>
                    </div>

                    <h2 className="auth-title">Create account</h2>
                    <p className="auth-subtitle">Get your workspace ready for coding.</p>

                    {error && (
                        <div className="auth-error">
                            <div className="auth-error-icon">!</div>
                            <p>{error}</p>
                        </div>
                    )}

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="auth-input-group">
                            <label className="auth-input-label">Email</label>
                            <div className="auth-input-wrapper">
                                <input
                                    className="auth-input"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                                <span className="auth-input-icon">@</span>
                            </div>
                        </div>

                        <div className="auth-input-group">
                            <label className="auth-input-label">Password</label>
                            <div className="auth-input-wrapper">
                                <input
                                    className="auth-input"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="********"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <span className="auth-input-icon">#</span>
                                <button
                                    className="auth-input-toggle"
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        <div className="auth-input-group">
                            <label className="auth-input-label">Confirm Password</label>
                            <div className="auth-input-wrapper">
                                <input
                                    className="auth-input"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    placeholder="********"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                                <span className="auth-input-icon">#</span>
                                <button
                                    className="auth-input-toggle"
                                    type="button"
                                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showConfirmPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        <button className="auth-submit" type="submit" disabled={loading}>
                            {loading ? (
                                <><span className="auth-spinner" /> Creating account...</>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Already have an account?{' '}
                        <Link to="/login">Sign in</Link>
                    </p>

                    <div className="auth-footer">
                        <p>~/felix.it <span className="footer-cursor" /></p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Signup;
