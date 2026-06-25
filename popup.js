async function scrapeData(format) {
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
      
      let filenameBase = document.getElementById('filenameInput').value.trim();
      if (!filenameBase) {
        filenameBase = data.event_name || 'attendance';
        document.getElementById('filenameInput').value = filenameBase;
      }
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        let jsonFilename = filenameBase.endsWith('.json') ? filenameBase : filenameBase + '.json';

        chrome.downloads.download({
          url: url,
          filename: jsonFilename,
          saveAs: true
        }, () => {
          statusDiv.textContent = `Scraped ${data.hosts?.length || 0} hosts, ${data.organizers?.length || 0} organizers, ${data.attendees?.length || 0} attendees!`;
        });
      } else if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text("Event Attendance", 10, 20);
        
        doc.setFontSize(12);
        doc.text("Time: " + (data.time_string || "N/A"), 10, 30);
        doc.text("Class Hours: " + (data.class_hours ? data.class_hours.join(", ") : "N/A"), 10, 38);
        
        let yPos = 50;
        
        function addSection(title, list) {
          if (yPos > 270) { doc.addPage(); yPos = 20; }
          doc.setFontSize(14);
          doc.text(title, 10, yPos);
          yPos += 8;
          
          doc.setFontSize(11);
          if (list && list.length > 0) {
            list.forEach(item => {
              const displayName = typeof item === 'object' && item !== null ? item.name : item;
              doc.text("- " + displayName, 15, yPos);
              yPos += 6;
              if (yPos > 280) { doc.addPage(); yPos = 20; }
            });
          } else {
            doc.text("None found", 15, yPos);
            yPos += 6;
          }
          yPos += 6;
        }

        if (data.hosts && data.hosts.length > 0) addSection("Hosts:", data.hosts);
        if (data.organizers && data.organizers.length > 0) addSection("Organizers:", data.organizers);
        addSection("Attendees:", data.attendees);

        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        
        let pdfFilename = filenameBase.endsWith('.pdf') ? filenameBase : filenameBase + '.pdf';

        chrome.downloads.download({
          url: url,
          filename: pdfFilename,
          saveAs: true
        }, () => {
          statusDiv.textContent = `Scraped ${data.hosts?.length || 0} hosts, ${data.organizers?.length || 0} organizers, ${data.attendees?.length || 0} attendees!`;
        });
      }
    } else {
      statusDiv.textContent = 'Failed to scrape data.';
    }
  });
}

document.getElementById('scrapeJsonBtn').addEventListener('click', () => scrapeData('json'));
document.getElementById('scrapePdfBtn').addEventListener('click', () => scrapeData('pdf'));
document.getElementById('cceaBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://maker-clubs.netlify.app' });
});
document.getElementById('optionsBtn').addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
});

document.getElementById('scrapeMembersBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Scraping members...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['member_scraper.js']
  }, (results) => {
    if (chrome.runtime.lastError) {
      statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
      return;
    }
    
    if (results && results[0] && results[0].result) {
      const data = results[0].result;
      
      if (data.supabaseUpdates && data.supabaseUpdates.length > 0) {
        const blob = new Blob([JSON.stringify(data.supabaseUpdates, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        chrome.downloads.download({
          url: url,
          filename: 'db.json',
          saveAs: true
        }, () => {
          statusDiv.textContent = `Scraped ${data.supabaseUpdates.length} members. Edit db.json and upload!`;
        });
      } else {
        statusDiv.textContent = 'No members found.';
      }
    } else {
      statusDiv.textContent = 'Failed to scrape members.';
    }
  });
});

document.getElementById('uploadSupabaseBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  const fileInput = document.getElementById('dbUploadInput');
  
  if (fileInput.files.length === 0) {
      statusDiv.textContent = 'Please select a db.json file first.';
      return;
  }
  
  const file = fileInput.files[0];
  const reader = new FileReader();
  
  reader.onload = async (e) => {
      let updates = [];
      try {
          updates = JSON.parse(e.target.result);
      } catch (err) {
          statusDiv.textContent = 'Invalid JSON file.';
          return;
      }
      
      if (!Array.isArray(updates)) {
          statusDiv.textContent = 'JSON should be an array of members.';
          return;
      }

      statusDiv.textContent = 'Uploading to Supabase...';
      
      chrome.storage.local.get(['supabaseUrl', 'supabaseKey'], async (storage) => {
        if (!storage.supabaseUrl || !storage.supabaseKey) {
          statusDiv.textContent = 'Error: Configure Supabase first.';
          return;
        }
        
        let supabaseSuccessCount = 0;
        for (const update of updates) {
           if (!update.email) continue;
           try {
             const res = await fetch(`${storage.supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(update.email)}`, {
                 method: 'PATCH',
                 headers: {
                     'apikey': storage.supabaseKey,
                     'Authorization': `Bearer ${storage.supabaseKey}`,
                     'Content-Type': 'application/json',
                     'Prefer': 'return=minimal'
                 },
                 body: JSON.stringify({ avatar_url: update.avatar_url })
             });
             if (res.ok) {
                 supabaseSuccessCount++;
             }
           } catch (err) {
               console.error("Supabase update error", err);
           }
        }
        statusDiv.textContent = `Upload complete! Synced ${supabaseSuccessCount} out of ${updates.length}.`;
      });
  };
  
  reader.readAsText(file);
});


