import { useState } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import IDE from './components/IDE';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  const handleAuth = (newToken) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
  };

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleAuth} />} />
        <Route path="/signup" element={<Signup onSignup={handleAuth} />} />
        <Route path="/*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard token={token} />} />
      <Route path="/login" element={<Navigate to="/" />} />
      <Route path="/signup" element={<Navigate to="/" />} />
      <Route path="/:projectName" element={<IDE token={token} />} />
      <Route path="/*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
