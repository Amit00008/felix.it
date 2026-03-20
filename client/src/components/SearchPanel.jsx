import { useState, useRef, useCallback } from 'react';
import { useIDE } from '../context/IDEContext';

const API = import.meta.env.VITE_API_URL;

function SearchPanel() {
  const { openFile, projectName, token } = useIDE();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const timerRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch(
        `${API}/files/search?query=${encodeURIComponent(q)}&project=${encodeURIComponent(projectName)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [projectName, token]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (timerRef.current) clearTimeout(timerRef.current);
      doSearch(query);
    }
  };

  const handleResultClick = (result) => {
    if (result.type === 'file') {
      openFile(result.path);
    }
  };

  return (
    <div className="search-panel">
      <div className="search-input-wrapper">
        <svg className="search-input-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M15.25 0a8.25 8.25 0 00-6.18 13.72L1 21.79l1.42 1.42 8.07-8.07A8.25 8.25 0 1015.25 0zm0 14.5a6.25 6.25 0 110-12.5 6.25 6.25 0 010 12.5z" />
        </svg>
        <input
          className="search-input"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search files..."
          autoFocus
        />
        {query && (
          <button
            className="search-clear"
            onClick={() => { setQuery(''); setResults([]); setSearched(false); }}
          >
            ×
          </button>
        )}
      </div>

      <div className="search-results">
        {searching && (
          <div className="search-status">Searching...</div>
        )}
        {!searching && searched && results.length === 0 && (
          <div className="search-status">No results found</div>
        )}
        {!searching && results.map((r, i) => (
          <div
            key={`${r.path}-${r.match}-${r.line || 0}-${i}`}
            className={`search-result ${r.type === 'folder' ? 'is-folder' : ''}`}
            onClick={() => handleResultClick(r)}
          >
            <div className="search-result-icon">
              {r.type === 'folder' ? '📁' : '📄'}
            </div>
            <div className="search-result-info">
              <div className="search-result-path">{r.path}</div>
              {r.match === 'content' && r.lineContent && (
                <div className="search-result-line">
                  <span className="search-result-line-num">L{r.line}</span>
                  <span className="search-result-line-text">{r.lineContent}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SearchPanel;
