const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const analyzeText = async (text) => {
  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, explain: true }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to analyze text');
  }

  return response.json();
};

export const submitFeedback = async (feedbackData) => {
  const response = await fetch(`${API_BASE_URL}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(feedbackData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to submit feedback');
  }

  return response.json();
};

export const getServerConfig = async () => {
  const response = await fetch(`${API_BASE_URL}/config`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch server configuration');
  }

  return response.json();
};