// src/services/api.js

const API_BASE_URL = '/api'; // Backend address

/**
 * Main chat interface
 * @param {object} chatData - Data sent to the backend
 * @returns {Promise<any>}
 */
export const postChatMessage = async (chatData) => {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chatData),
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
};

/**
 * Adds a new version node to the backend memory.
 * @param {object} versionData - The version data
 * @returns {Promise<any>}
 */
export const addVersionNode = async (versionData) => {
  const response = await fetch(`${API_BASE_URL}/add_version_node`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(versionData),
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
};

/**
 * Deletes a version node from the backend memory.
 * @param {object} deleteData - Data required for deletion
 * @returns {Promise<any>}
 */
export const deleteVersionNode = async (deleteData) => {
  const response = await fetch(`${API_BASE_URL}/delete_version`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deleteData),
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
};

/**
 * Sends a merge request to the backend.
 * @param {object} mergeData - Data for merging two versions.
 * @returns {Promise<any>}
 */
export const postMergeRequest = async (mergeData) => {
  const response = await fetch(`${API_BASE_URL}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mergeData),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error on merge: ${response.statusText} - ${errorBody}`);
  }
  return response.json();
};


/**
 * ‼️【修改】Gets modification style tag recommendations from the backend.
 * This function no longer needs any parameters.
 * @returns {Promise<string[]>} A promise that resolves to an array of style tags.
 */
export const getModifyStyleTags = async () => {
  const response = await fetch(`${API_BASE_URL}/modify/recommend-styles`, {
    method: 'POST', // The endpoint still uses POST, but with an empty body
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}), // Send an empty JSON object
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error on getting style tags: ${response.statusText} - ${errorBody}`);
  }
  return response.json();
};

/**
 * ‼️【修改】Sends a request to apply a modification style to the code.
 * The request body is now much simpler.
 * @param {object} applyData - Data for applying the style, now only needs { style_tag: '...' }.
 * @returns {Promise<any>}
 */
export const applyModificationStyle = async (applyData) => {
  const response = await fetch(`${API_BASE_URL}/modify/apply-style`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(applyData), // Body should be { style_tag: '...' }
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error on applying style: ${response.statusText} - ${errorBody}`);
  }
  return response.json();
};



/**
 * Sends the collected timing data for different UI regions to the backend.
 * @param {object} timingData - The timing data to send.
 * @returns {Promise<any>}
 */
export const sendTimingData = async (timingData) => {
  const response = await fetch(`${API_BASE_URL}/timing`, { // 假设后端的路由是 /timing
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(timingData),
  });
  if (!response.ok) {
    throw new Error(`API Error on sending timing data: ${response.statusText}`);
  }
  console.log("Timing data sent successfully:", timingData);
  return response.json();
};