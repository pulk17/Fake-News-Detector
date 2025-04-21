import React from 'react';
import { FaExternalLinkAlt, FaSearch } from 'react-icons/fa';

function FactCheckResults({ factCheckData }) {
  const { claims } = factCheckData;
  
  return (
    <div className="fact-check-section">
      <h3><FaSearch /> Fact Check Results</h3>
      
      {claims.length > 0 ? (
        <div className="claims-list">
          {claims.map((claim, index) => (
            <div key={index} className="claim-item">
              <div className="claim-content">
                <p className="claim-text">"{claim.text}"</p>
                <p className="claim-claimant">
                  <strong>Claimed by:</strong> {claim.claimant || 'Unknown'}
                </p>
              </div>
              
              <div className="claim-rating">
                <div className={`rating-badge ${getRatingClass(claim.rating)}`}>
                  {claim.rating || 'No Rating'}
                </div>
                
                {claim.url && (
                  <a 
                    href={claim.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="source-link"
                  >
                    Source <FaExternalLinkAlt />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-claims">No fact-check claims found for this text.</p>
      )}
    </div>
  );
}

function getRatingClass(rating) {
  if (!rating) return 'unknown';
  
  const lowerRating = rating.toLowerCase();
  if (lowerRating.includes('false') || lowerRating.includes('fake')) return 'false';
  if (lowerRating.includes('true') || lowerRating.includes('accurate')) return 'true';
  if (lowerRating.includes('mixed') || lowerRating.includes('partial')) return 'mixed';
  
  return 'unknown';
}

export default FactCheckResults;