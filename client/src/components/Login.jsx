import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Auth.css';

function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                setError(errorData.message || 'Invalid login credentials. Please check your email and password.');
                setLoading(false);
                return;
            }

            const data = await response.json();

            if (data.token) {
                localStorage.setItem('token', data.token);
                onLogin(data.token);
                setEmail('');
                setPassword('');
            } else {
                setError('Invalid login credentials');
            }
        } catch (err) {
            console.error('Login failed:', err);
            setError('Login failed. Please try again.');
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
                            <p>felix.it / workspace</p>
                        </div>

                        <div className="auth-window-body">
                            <div className="auth-code-line"><span>1</span><code>const project = "felix.it";</code></div>
                            <div className="auth-code-line"><span>2</span><code>const session = await auth.signIn(email, password);</code></div>
                            <div className="auth-code-line"><span>3</span><code>openWorkspace(session.defaultProject);</code></div>
                            <div className="auth-code-line"><span>4</span><code>{'renderIDE({ theme: "vscode-dark" });'}</code></div>
                        </div>
                    </div>

                    <div className="auth-showcase-copy">
                        <h3>Code-first workspace, no clutter.</h3>
                        <p>Jump straight into projects with an interface that feels like your daily editor setup.</p>
                    </div>

                    <ul className="auth-showcase-list">
                        <li>Quick project switching</li>
                        <li>Terminal and file tree built in</li>
                        <li>Persistent sessions per account</li>
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

                    <h2 className="auth-title">Sign in</h2>
                    <p className="auth-subtitle">Connect and continue where you left off.</p>

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

                        <button className="auth-submit" type="submit" disabled={loading}>
                            {loading ? (
                                <><span className="auth-spinner" /> Signing in...</>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Don&apos;t have an account?{' '}
                        <Link to="/signup">Create one</Link>
                    </p>

                    <div className="auth-footer">
                        <p>~/felix.it <span className="footer-cursor" /></p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;
