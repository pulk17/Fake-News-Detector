const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper function to get token from localStorage

const getToken = () => {
  const token = localStorage.getItem('authToken');
  if (!token) {
    return null;
  }
  
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    console.warn('Stored token does not appear to be a valid JWT');
    localStorage.removeItem('authToken');
    return null;
  }
  
  return token;
};

export const analyzeText = async (text) => {
  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // No token needed for prediction in this setup
    },
    body: JSON.stringify({ text, explain: true }), // Assuming explain is always true now
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { error: `HTTP error! status: ${response.status}` };
    }
    console.error("AnalyzeText API Error Response:", errorData);
    throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const submitFeedback = async (feedbackData) => {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required to submit feedback.");
  }

  try {
    const response = await fetch(`${API_BASE_URL}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(feedbackData),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: `HTTP error! status: ${response.status}` };
      }
      
      console.error("SubmitFeedback API Error Response:", errorData);
      
      // Better error handling
      if (response.status === 401) {
        // Clear the invalid token
        localStorage.removeItem('authToken');
        throw new Error(errorData?.message || "Unauthorized: Token is invalid or expired.");
      }
      
      throw new Error(errorData?.error || errorData?.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (err) {
    console.error("API request error:", err);
    throw err; 
  }
};

export const getServerConfig = async () => {
  const response = await fetch(`${API_BASE_URL}/config`);

  if (!response.ok) {
    throw new Error('Failed to fetch server configuration');
  }

  return response.json();
};


export const loginUser = async (credentials) => {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials), // { email, password }
  });

  if (!response.ok) {
    let errorData;
     try {
      errorData = await response.json();
    } catch (e) {
      errorData = { error: `HTTP error! status: ${response.status}` };
    }
     console.error("Login API Error Response:", errorData);
    throw new Error(errorData?.error || `Login failed (status ${response.status})`);
  }

  return response.json(); // Expecting { access_token: "..." }
};

export const registerUser = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData), // { email, password }
  });

   if (!response.ok && response.status !== 201) { // 201 is success for register
     let errorData;
     try {
        errorData = await response.json();
     } catch (e) {
        errorData = { error: `HTTP error! status: ${response.status}` };
     }
      console.error("Register API Error Response:", errorData);
      throw new Error(errorData?.error || `Registration failed (status ${response.status})`);
    }

  return response.json(); // Expecting { message: "...", user_id: "..." }
};