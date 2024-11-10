import React, { useEffect, useRef } from 'react'
import socket from '../socket';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import '@xterm/xterm/css/xterm.css'
import './Terminal.css';

function Terminal() {
  
   const TerminalRef = useRef();
   const IsRendered = useRef(false);
   const terminalRef = useRef(null); // Store the terminal instance

    useEffect(()=>{
    if(IsRendered.current) return;
    IsRendered.current = true;
    terminalRef.current = new XTerm({
      rows: 20,
      cols: 80,
      theme: {
        background: '#2e2e2e', // Dark background
        foreground: '#f0f0f0', // Light text color
        cursor: '#ffcc00', // Cursor highlight color
      },
    });

    const fitAddon = new FitAddon();
    terminalRef.current.loadAddon(fitAddon);
    terminalRef.current.open(TerminalRef.current);
    fitAddon.fit();

    terminalRef.current.onData((data) => {
      socket.emit('terminal:write', data);
    });

    socket.on('terminal:data', (data) => {
      terminalRef.current.write(data);
    });

    window.addEventListener('resize', () => {
      fitAddon.fit();
    });
   
 
  }, []);

    

  return (
    <div ref={TerminalRef} id='terminal'></div>
  )
}

export default Terminal