import { textbook_info, save_book_info, baidu_user_info, replaceLatexWithImages, replacePunctuation, doc_img_upload, doc_save_page, llm_test, dash_userlist_label } from "../lib.js";

console.log('hello from content_scripts');

// Create a long-lived connection with the background script
let port = null;

// Function to establish connection with background script
function connectToBackground() {
  // Create a new connection
  port = chrome.runtime.connect({ name: "content-script" });
  
  // Listen for messages from the background script
  port.onMessage.addListener(async (message) => {
    console.log('Content script received message:', message);
    
    if (message.action === 'fetchFilterData') {
      try {
        // Call the dash_userlist_label function to get the data
        const response = await dash_userlist_label();
        
        // Send the data back to the background script
        port.postMessage({
          action: 'filterDataResponse',
          data: response
        });
      } catch (error) {
        console.error('Error fetching filter data:', error);
        port.postMessage({
          action: 'filterDataResponse',
          error: error.message
        });
      }
    }
  });
  
  // Handle disconnection
  port.onDisconnect.addListener(() => {
    console.log('Disconnected from background script. Attempting to reconnect...');
    port = null;
    
    // Try to reconnect after a short delay
    setTimeout(connectToBackground, 1000);
  });
  
  // Notify background script that content script is ready
  port.postMessage({ action: 'contentScriptReady' });
}

// Initialize connection
connectToBackground();

// Re-establish connection when the page becomes visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !port) {
    console.log('Page became visible. Reconnecting to background script...');
    connectToBackground();
  }
});
