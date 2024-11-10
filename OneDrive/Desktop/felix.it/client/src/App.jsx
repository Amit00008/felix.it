import { useCallback, useEffect, useState } from 'react';
import './App.css';
import Terminal from './components/Terminal';
import Tree from './components/tree';
import socket from './socket'; // Ensure this is correctly set up and connected
import Editor from "@monaco-editor/react";
import Login from './components/Login';
import Signup from './components/Signup';
import { Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import WelcomeScreen from './components/Welcome';
import axios from 'axios';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [showSignup, setShowSignup] = useState(false);
  const [FileTree, setFileTree] = useState({});
  const [selectedFiles, setSelectedFiles] = useState("");
  const [selectedFilesContent, setSelectedFilesContent] = useState("");
  const [code, setCode] = useState("");
  const isSaved = selectedFilesContent === code;
  const [showTerminal, setShowTerminal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === '`') {
        event.preventDefault();
        setShowTerminal((prevShowTerminal) => !prevShowTerminal);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === 'h') {
        event.preventDefault();
        const filesDiv = document.querySelector('.side-navbar');
        if (filesDiv) {
          filesDiv.style.display = filesDiv.style.display === 'none' ? 'block' : 'none';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);


  // get email id

  const [username, setUsername] = useState('');

  useEffect(()=>{
    const getEmail = async () => {
      const res = await axios.get(`http://localhost:4001/user/email?token=${token}`);
      const email = res.data.email;
      const mduser = email.substring(0, email.indexOf('@')).replace(/[0-9]/g, '');
      setUsername(mduser);
    }
    
    getEmail();
  },[])

 // authenticating

  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      socket.emit('authenticate', token);
      navigate('/');
    }
  }, [token, navigate]);

  //---------------------------

  // Handle login and signup
  const handleLogin = (newToken) => {
    setToken(newToken);
    localStorage.setItem('token', newToken); // Save token to localStorage
  };

  const handleSignup = (newToken) => {
    setToken(newToken);
    localStorage.setItem('token', newToken); // Save token to localStorage
  };

  // Toggle between login and signup
  const toggleAuthMode = () => setShowSignup(!showSignup);

  // If there's no token, show either Login or Signup component
  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/signup" element={<Signup onSignup={handleSignup} />} />
        <Route path="/*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  

  // Token is available, load the file tree and editor
  const GetFileContent = useCallback(async () => {
    if (!selectedFiles) return;
    const res = await fetch(`http://localhost:4001/files/content?path=${selectedFiles}`);
    const data = await res.json();
    setSelectedFilesContent(data.content);
  }, [selectedFiles]);

  useEffect(() => {
    if (selectedFiles) GetFileContent();
  }, [GetFileContent, selectedFiles]);

  const GetFileTree = async () => {
    const res = await fetch('http://localhost:4001/files');
    const data = await res.json();
    setFileTree(data.tree);
  };

  useEffect(() => {
    socket.on('file:refresh', GetFileTree);
    return () => {
      socket.off('file:refresh', GetFileTree);
    };
  }, []);

  useEffect(() => {
    GetFileTree(); 
  }, []);

  useEffect(() => {
    if (selectedFilesContent && selectedFiles) {
      setCode(selectedFilesContent);
    };
  }, [selectedFiles, selectedFilesContent]);

  useEffect(() => {
    if (code && !isSaved) {
      const timer = setTimeout(() => {
        socket.emit('file:write', {
          dir: selectedFiles,
          content: code
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [code, isSaved, selectedFiles]);

  useEffect(() => {
    setCode("");
  }, [selectedFiles]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        if (!isSaved) {
          socket.emit('file:write', {
            dir: selectedFiles,
            content: code
          });
          setSelectedFilesContent(code);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [code, isSaved, selectedFiles, setSelectedFilesContent]);

  const getFileMode = (selectedFiles) => {
    const extension = selectedFiles.split('.').pop();
    switch (extension) {
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'json':
        return 'json';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      default:
        return 'text';
    }
  };

  return (
    <div className="playground">
  <div className="editor">
    <div className="side-navbar">
      <div className="files">
        <Tree onSelect={(path) => setSelectedFiles(path)} tree={FileTree} />
      </div>
    </div>

    <div className="edit">
      {selectedFiles ? (
        <>
          <h3>{selectedFiles.replaceAll('/', ' > ')}</h3>
          {isSaved ? (
            <p style={{ color: 'green' }}>Saved</p>
          ) : (
            <p style={{ color: 'red' }}>Unsaved</p>
          )}
          <Editor
            width="90vh"
            height="60vh"
            language={getFileMode(selectedFiles)}
            theme="vs-dark"
            value={code}
            onChange={(e) => setCode(e)}
            options={{
              inlineSuggest: true,
              fontSize: "16px",
              formatOnType: true,
              autoClosingBrackets: true,
              minimap: { scale: 5 },
            }}
          />
        </>
      ) : (
        <div className="homepage">
         <WelcomeScreen user={username} />
        </div>
      )}
    </div>
  </div>

  <div className="terminal">
    {showTerminal && <Terminal />}
  </div>
</div>

  );
}

export default App;
