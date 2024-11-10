import React, { useState } from 'react';
import './Tree.css';

const FileTree = ({ Filename, Nodes, path, onSelect }) => {
    const isDir = !!Nodes;
    const [isOpen, setIsOpen] = useState(false); // State to toggle folder open/close

    const handleClick = (e) => {
        e.stopPropagation();
        if (isDir) {
            setIsOpen(!isOpen); // Toggle folder open/close
        } else {
            onSelect(path); // Select file
        }
    };

    return (
        <div style={{ marginLeft: '10px', cursor: isDir ? 'pointer' : 'default' }}>
           
            <div onClick={handleClick} className={`file-tree-item ${isDir ? "folder" : "file"}`}>
                {isDir && (
                    <span className={`folder-icon ${isOpen ? 'open' : ''}`}>
                        {isOpen ? '📂' : '📁'}
                    </span>
                )}
                <span className={isDir ? "" : "is-file"}>{Filename}</span>
            </div>
            {isOpen && Nodes && Filename !== 'node_modules' && (
                <ul className="file-tree">
                    {Object.keys(Nodes).map((child) => (
                        <li key={child}>
                            <FileTree
                                onSelect={onSelect}
                                path={`${path}/${child}`}
                                Filename={child}
                                Nodes={Nodes[child]}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const Tree = ({ tree, onSelect }) => {
    return (
        <div>
            <FileTree onSelect={onSelect} Filename="./" path="" Nodes={tree} />
        </div>
    );
};

export default Tree;
