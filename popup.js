const UI = {
  status: document.getElementById('status'),
  filenameInput: document.getElementById('filenameInput'),
  themeToggle: document.getElementById('themeToggle'),
  scrapePdfBtn: document.getElementById('scrapePdfBtn'),
  scrapeJsonBtn: document.getElementById('scrapeJsonBtn'),
  scrapeMembersBtn: document.getElementById('scrapeMembersBtn'),
  downloadDbBtn: document.getElementById('downloadDbBtn'),
  clearDbBtn: document.getElementById('clearDbBtn'),
  dbUploadInput: document.getElementById('dbUploadInput'),
  uploadSupabaseBtn: document.getElementById('uploadSupabaseBtn'),
  optionsBtn: document.getElementById('optionsBtn'),
  cceaBtn: document.getElementById('cceaBtn')
};

const setStatus = (msg, duration = null) => {
  UI.status.textContent = msg;
  if (duration) {
    setTimeout(() => { UI.status.textContent = ''; }, duration);
  }
};

const filterPercentages = (list) => {
  if (!list) return [];
  return list.filter(item => {
    const name = typeof item === 'object' && item !== null ? item.name : item;
    return !/\\d+%/.test(name);
  });
};

const formatMemberForPdf = (item) => {
  if (typeof item !== 'object' || item === null) return item;
  
  let details = [];
  if (item.department) details.push(item.department);
  if (item.year) details.push(item.year);
  
  let idDetails = [];
  if (item.register_number) idDetails.push(`Reg: ${item.register_number}`);
  if (item.roll_no) idDetails.push(`Roll: ${item.roll_no}`);
  
  let formatted = item.name || "Unknown";
  if (details.length > 0) formatted += ` - ${details.join(' ')}`;
  if (idDetails.length > 0) formatted += ` (${idDetails.join(', ')})`;
  
  return formatted;
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
          const displayName = formatMemberForPdf(item);
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

const handleScrapeResult = (format, results) => {
  if (chrome.runtime.lastError) {
    setStatus(`Error: ${chrome.runtime.lastError.message}`);
    return;
  }
  
  if (results && results[0] && results[0].result) {
    const data = results[0].result;
    
    let filenameBase = UI.filenameInput.value.trim();
    if (!filenameBase) {
      filenameBase = data.event_name || 'attendance';
      UI.filenameInput.value = filenameBase;
    }
    
    if (format === 'json') {
      downloadJSON(data, filenameBase);
    } else if (format === 'pdf') {
      generateAndDownloadPDF(data, filenameBase);
    }
  } else {
    setStatus('Failed to scrape data.');
  }
};

const executeScrape = async (format) => {
  setStatus('Scraping...');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }, (results) => handleScrapeResult(format, results));
};

const handleScrapeMembersResult = (results) => {
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
};

const executeMemberScrape = async () => {
  setStatus('Scraping members...');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['member_scraper.js']
  }, handleScrapeMembersResult);
};

const openMakerClubs = () => {
  chrome.storage.local.get(['makerClubsUrl'], (storage) => {
    const url = storage.makerClubsUrl || 'https://maker-clubs.netlify.app';
    chrome.tabs.create({ url });
  });
};

const openOptions = () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
};

const downloadLocalDb = () => {
  chrome.storage.local.get(['supabaseUpdates'], (storage) => {
    const updates = storage.supabaseUpdates || [];
    if (updates.length > 0) {
      const blob = new Blob([JSON.stringify(updates, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({ url, filename: 'local_members.json', saveAs: true }, () => {
        setStatus(`Downloaded local DB with ${updates.length} members.`, 3000);
      });
    } else {
      setStatus('No members accumulated yet.', 3000);
    }
  });
};

const clearLocalDb = () => {
  chrome.storage.local.remove(['supabaseUpdates', 'memberDB'], () => {
    setStatus('Local database cleared.', 3000);
  });
};

const uploadToSupabase = async () => {
  const file = UI.dbUploadInput.files[0];
  if (!file) {
    setStatus('Please select a JSON file first.', 3000);
    return;
  }
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    let updates = [];
    try {
      updates = JSON.parse(e.target.result);
    } catch {
      setStatus('Invalid JSON file.', 3000);
      return;
    }
    
    if (!Array.isArray(updates)) {
      setStatus('JSON should be an array of members.', 3000);
      return;
    }

    setStatus('Uploading to Supabase...');
    const storage = await new Promise(res => chrome.storage.local.get(['supabaseUrl', 'supabaseKey'], res));
    
    if (!storage.supabaseUrl || !storage.supabaseKey) {
      setStatus('Error: Configure Supabase first.', 4000);
      return;
    }
    
    let successCount = 0;
    for (const update of updates) {
      if (!update.email) continue;
      
      const payload = { avatar_url: update.avatar_url };
      if (update.name) payload.name = update.name;
      
      try {
        const res = await fetch(`${storage.supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(update.email)}`, {
          method: 'PATCH',
          headers: {
            'apikey': storage.supabaseKey,
            'Authorization': `Bearer ${storage.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) successCount++;
      } catch (err) {
        console.error("Supabase update error", err);
      }
    }
    setStatus(`Upload complete! Synced ${successCount} out of ${updates.length}.`);
  };
  reader.readAsText(file);
};

const initializeEventListeners = () => {
  UI.scrapeJsonBtn.addEventListener('click', () => executeScrape('json'));
  UI.scrapePdfBtn.addEventListener('click', () => executeScrape('pdf'));
  UI.cceaBtn.addEventListener('click', openMakerClubs);
  UI.optionsBtn.addEventListener('click', openOptions);
  UI.scrapeMembersBtn.addEventListener('click', executeMemberScrape);
  UI.downloadDbBtn.addEventListener('click', downloadLocalDb);
  UI.clearDbBtn.addEventListener('click', clearLocalDb);
  UI.uploadSupabaseBtn.addEventListener('click', uploadToSupabase);
};

document.addEventListener('DOMContentLoaded', initializeEventListeners);


