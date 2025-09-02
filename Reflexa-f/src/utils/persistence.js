// src/utils/persistence.js

export const SESSION_STORAGE_KEY = 'p5-ai-collaborator-session-vue';

/**
 * Gets the default p5.js code.
 * @returns {string} The default code string.
 */
export function getDefaultCode() {
  return `function setup() {
  createCanvas(635, 720);
}

function draw() {
  background(220);
}`;
}

/**
 * Loads the application state from session storage.
 * @returns {object | null} The parsed state object or null if not found.
 */
export function loadStateFromSessionStorage() {
  try {
    const serializedState = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (serializedState) {
      return JSON.parse(serializedState);
    }
  } catch (error) {
    console.error("Error loading state from session storage:", error);
  }
  return null;
}

/**
 * Saves the application state to session storage.
 * @param {object} state - The state object to persist.
 */
export function saveStateToSessionStorage(state) {
  try {
    const serializedState = JSON.stringify(state);
    sessionStorage.setItem(SESSION_STORAGE_KEY, serializedState);
  } catch (error) {
    console.error("Error saving state to session storage:", error);
  }
}

export function clearSessionStorage() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    console.log('Session storage cleared.');
  } catch (error) {
    console.error("Error clearing session storage:", error);
  }
}