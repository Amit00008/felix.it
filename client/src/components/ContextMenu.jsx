import { useEffect, useRef } from 'react';
import { useIDE } from '../context/IDEContext';

function ContextMenu() {
  const { contextMenu, setContextMenu } = useIDE();
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (rect.right > vw) {
      menuRef.current.style.left = `${vw - rect.width - 4}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${vh - rect.height - 4}px`;
    }
  }, [contextMenu]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setContextMenu]);

  if (!contextMenu) return null;

  return (
    <>
      <div className="context-menu-overlay" onClick={() => setContextMenu(null)} />
      <div
        ref={menuRef}
        className="context-menu"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        {contextMenu.items.map((item, i) => {
          if (item.separator) {
            return <div key={`sep-${i}`} className="context-menu-separator" />;
          }
          return (
            <div
              key={item.label}
              className={`context-menu-item ${item.danger ? 'danger' : ''}`}
              onClick={() => {
                setContextMenu(null);
                item.action();
              }}
            >
              <span className="context-menu-item-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.shortcut && (
                <span className="context-menu-item-shortcut">{item.shortcut}</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default ContextMenu;
