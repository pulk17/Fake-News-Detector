import React from 'react';
import { FaHistory, FaTrash, FaSearch } from 'react-icons/fa';

function SearchHistory({ history, onItemClick, onClearHistory }) {
  if (!history || history.length === 0) {
    return (
      <div className="search-history-empty">
        <FaHistory />
        <p>No recent searches</p>
      </div>
    );
  }
  
  return (
    <div className="search-history">
      <div className="search-history-header">
        <h3><FaHistory /> Recent Searches</h3>
        <button 
          className="clear-history-button" 
          onClick={onClearHistory}
          title="Clear all history"
        >
          <FaTrash />
        </button>
      </div>
      
      <ul className="history-list">
        {history.map((item, index) => (
          <li key={index} className="history-item">
            <button 
              className="history-button" 
              onClick={() => onItemClick(item.text)}
              title="Search again"
            >
              <FaSearch className="history-icon" />
              <span className="history-text">{item.text.substring(0, 50)}...</span>
              <span className={`history-badge ${item.result.toLowerCase()}`}>
                {item.result}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SearchHistory;