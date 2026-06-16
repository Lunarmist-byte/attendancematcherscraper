document.getElementById('scrapeBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Scraping...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }, (results) => {
    if (chrome.runtime.lastError) {
      statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
      return;
    }
    
    if (results && results[0] && results[0].result) {
      const data = results[0].result;
      
      // Download the JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: 'attendance.json',
        saveAs: true
      }, () => {
        statusDiv.textContent = `Scraped ${data.attendees.length} attendees!`;
      });
    } else {
      statusDiv.textContent = 'Failed to scrape data.';
    }
  });
});
