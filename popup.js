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
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        chrome.downloads.download({
          url: url,
          filename: 'attendance.json',
          saveAs: true
        }, () => {
          statusDiv.textContent = `Scraped ${data.attendees.length} attendees & ${data.rejected?.length || 0} rejected!`;
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
        doc.setFontSize(14);
        doc.text("Attendees:", 10, yPos);
        yPos += 8;
        
        doc.setFontSize(11);
        if (data.attendees && data.attendees.length > 0) {
          data.attendees.forEach(name => {
            doc.text("- " + name, 15, yPos);
            yPos += 6;
            if (yPos > 280) { doc.addPage(); yPos = 20; }
          });
        } else {
          doc.text("None found", 15, yPos);
          yPos += 6;
        }
        
        yPos += 6;
        if (yPos > 270) { doc.addPage(); yPos = 20; }
        
        doc.setFontSize(14);
        doc.text("Rejected (Missed):", 10, yPos);
        yPos += 8;
        
        doc.setFontSize(11);
        if (data.rejected && data.rejected.length > 0) {
          data.rejected.forEach(name => {
            doc.text("- " + name, 15, yPos);
            yPos += 6;
            if (yPos > 280) { doc.addPage(); yPos = 20; }
          });
        } else {
          doc.text("None found", 15, yPos);
          yPos += 6;
        }

        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        
        chrome.downloads.download({
          url: url,
          filename: 'attendance.pdf',
          saveAs: true
        }, () => {
          statusDiv.textContent = `Scraped ${data.attendees.length} attendees & ${data.rejected?.length || 0} rejected!`;
        });
      }
    } else {
      statusDiv.textContent = 'Failed to scrape data.';
    }
  });
}

document.getElementById('scrapeJsonBtn').addEventListener('click', () => scrapeData('json'));
document.getElementById('scrapePdfBtn').addEventListener('click', () => scrapeData('pdf'));
