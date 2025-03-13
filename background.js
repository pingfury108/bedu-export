import {ocr_text, llm_test} from "./lib.js";

console.log('Hello from the background script!')

const isFirefoxLike =
  process.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
    process.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

if (isFirefoxLike) {
  browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.open()
  })
} else {
  chrome.action.onClicked.addListener(() => {
    chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})
  })
}

// Store connections from content scripts and sidebar
const connections = {
  contentScript: null,
  sidebar: null
};

// Queue for pending requests when content script is not available
const pendingRequests = [];

// Check if we have active tabs that match our content script URL pattern
async function checkForContentScriptTabs() {
  try {
    // Get all tabs that match our content script URL pattern
    const tabs = await chrome.tabs.query({
      url: "https://easylearn.baidu.com/*"
    });
    
    return tabs.length > 0;
  } catch (error) {
    console.error("Error checking for content script tabs:", error);
    return false;
  }
}

// Handle connections from content scripts and sidebar
chrome.runtime.onConnect.addListener((port) => {
  console.log('New connection established:', port.name);

  if (port.name === "content-script") {
    connections.contentScript = port;
    
    port.onMessage.addListener((message) => {
      console.log('Background received message from content script:', message);
      
      // Relay messages from content script to sidebar if connected
      if (connections.sidebar) {
        connections.sidebar.postMessage(message);
      }
      
      // If this is a contentScriptReady message, process any pending requests
      if (message.action === 'contentScriptReady' && pendingRequests.length > 0) {
        console.log('Processing pending requests:', pendingRequests.length);
        
        // Process all pending requests
        pendingRequests.forEach(request => {
          port.postMessage(request);
        });
        
        // Clear the pending requests
        pendingRequests.length = 0;
      }
    });
    
    port.onDisconnect.addListener(() => {
      console.log('Content script disconnected');
      connections.contentScript = null;
    });
  } 
  else if (port.name === "sidebar") {
    connections.sidebar = port;
    
    port.onMessage.addListener(async (message) => {
      console.log('Background received message from sidebar:', message);
      
      // Relay messages from sidebar to content script if connected
      if (connections.contentScript) {
        connections.contentScript.postMessage(message);
      } else {
        // If content script is not connected, check if we have any matching tabs
        const hasMatchingTabs = await checkForContentScriptTabs();
        
        if (hasMatchingTabs) {
          // If we have matching tabs but no connection, queue the request
          console.log('Content script not connected but matching tabs found. Queueing request:', message);
          pendingRequests.push(message);
          
          // Inform sidebar that request is pending
          port.postMessage({
            action: 'requestPending',
            message: '正在等待页面连接，请稍候...'
          });
        } else {
          // If no matching tabs, send an error back to sidebar
          console.log('No matching tabs found. Sending error to sidebar.');
          port.postMessage({
            action: 'error',
            error: '未找到有效页面。请导航到 easylearn.baidu.com 页面后重试。'
          });
        }
      }
    });
    
    port.onDisconnect.addListener(() => {
      console.log('Sidebar disconnected');
      connections.sidebar = null;
    });
  }
});
