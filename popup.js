const setStatus = (msg) => {
  document.getElementById('status').textContent = msg;
};

const filterPercentages = (list) => {
  if (!list) return [];
  return list.filter(item => {
    const name = typeof item === 'object' && item !== null ? item.name : item;
    return !/\\d+%/.test(name);
  });
};

const downloadJSON = (data, filenameBase) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const jsonFilename = filenameBase.endsWith('.json') ? filenameBase : `${filenameBase}.json`;

  chrome.downloads.download({ url, filename: jsonFilename, saveAs: true }, () => {
    setStatus(`Scraped ${data.hosts?.length || 0} hosts, ${data.organizers?.length || 0} organizers, ${data.attendees?.length || 0} attendees, ${data.missed?.length || 0} missed!`);
  });
};

const generateAndDownloadPDF = (data, filenameBase) => {
  const { jsPDF } = window.jspdf;

  const createPDFDoc = (pdfTitle, sectionsData, filename) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(pdfTitle, 10, 20);
    
    doc.setFontSize(12);
    doc.text(`Time: ${data.time_string || "N/A"}`, 10, 30);
    doc.text(`Class Hours: ${data.class_hours ? data.class_hours.join(", ") : "N/A"}`, 10, 38);
    
    let yPos = 50;
    
    const addSection = (title, list) => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      doc.setFontSize(14);
      doc.text(title, 10, yPos);
      yPos += 8;
      
      doc.setFontSize(11);
      if (list && list.length > 0) {
        list.forEach(item => {
          const displayName = typeof item === 'object' && item !== null ? item.name : item;
          doc.text(`- ${displayName}`, 15, yPos);
          yPos += 6;
          if (yPos > 280) { doc.addPage(); yPos = 20; }
        });
      } else {
        doc.text("None found", 15, yPos);
        yPos += 6;
      }
      yPos += 6;
    };

    sectionsData.forEach(sec => {
      if (sec.list && sec.list.length > 0) {
        addSection(sec.title, sec.list);
      }
    });

    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    
    chrome.downloads.download({ url, filename, saveAs: true });
  };

  const pdfFilename = filenameBase.endsWith('.pdf') ? filenameBase : `${filenameBase}.pdf`;
  const missedFilename = filenameBase.endsWith('.pdf') ? filenameBase.replace('.pdf', '_missed.pdf') : `${filenameBase}_missed.pdf`;

  const mainSections = [
    { title: "Hosts:", list: filterPercentages(data.hosts) },
    { title: "Organizers:", list: filterPercentages(data.organizers) },
    { title: "Attendees:", list: filterPercentages(data.attendees) }
  ];

  createPDFDoc("Event Attendance", mainSections, pdfFilename);

  if (data.missed && data.missed.length > 0) {
    createPDFDoc("Missed Attendance", [{ title: "Missed:", list: data.missed }], missedFilename);
  }

  setStatus(`Scraped ${data.hosts?.length || 0} hosts, ${data.organizers?.length || 0} organizers, ${data.attendees?.length || 0} attendees, ${data.missed?.length || 0} missed!`);
};

async function scrapeData(format) {
  setStatus('Scraping...');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }, (results) => {
    if (chrome.runtime.lastError) {
      setStatus(`Error: ${chrome.runtime.lastError.message}`);
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
        downloadJSON(data, filenameBase);
      } else if (format === 'pdf') {
        generateAndDownloadPDF(data, filenameBase);
      }
    } else {
      setStatus('Failed to scrape data.');
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
  setStatus('Scraping members...');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['member_scraper.js']
  }, (results) => {
    if (chrome.runtime.lastError) {
      setStatus(`Error: ${chrome.runtime.lastError.message}`);
      return;
    }
    if (results && results[0] && results[0].result) {
      const data = results[0].result;
      setStatus(`Scraped ${data.newUpdatesCount} new members. Total accumulated: ${data.totalUpdatesCount}.`);
    } else {
      setStatus('Failed to scrape members.');
    }
  });
});

document.getElementById('downloadDbBtn').addEventListener('click', () => {
  chrome.storage.local.get(['supabaseUpdates'], (storage) => {
    const updates = storage.supabaseUpdates || [];
    if (updates.length > 0) {
      const blob = new Blob([JSON.stringify(updates, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({ url, filename: 'db.json', saveAs: true }, () => {
        setStatus(`Downloaded db.json with ${updates.length} members.`);
      });
    } else {
      setStatus('No members accumulated yet.');
    }
  });
});

document.getElementById('clearDbBtn').addEventListener('click', () => {
  chrome.storage.local.remove(['supabaseUpdates', 'memberDB'], () => {
    setStatus('Accumulated database cleared.');
  });
});

document.getElementById('uploadSupabaseBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('dbUploadInput');
  if (fileInput.files.length === 0) {
    setStatus('Please select a db.json file first.');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    let updates = [];
    try {
      updates = JSON.parse(e.target.result);
    } catch {
      setStatus('Invalid JSON file.');
      return;
    }
    
    if (!Array.isArray(updates)) {
      setStatus('JSON should be an array of members.');
      return;
    }

    setStatus('Uploading to Supabase...');
    chrome.storage.local.get(['supabaseUrl', 'supabaseKey'], async (storage) => {
      if (!storage.supabaseUrl || !storage.supabaseKey) {
        setStatus('Error: Configure Supabase first.');
        return;
      }
      
      let successCount = 0;
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
          if (res.ok) successCount++;
        } catch (err) {
          console.error("Supabase update error", err);
        }
      }
      setStatus(`Upload complete! Synced ${successCount} out of ${updates.length}.`);
    });
  };
  reader.readAsText(fileInput.files[0]);
});


