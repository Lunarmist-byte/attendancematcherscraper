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
          statusDiv.textContent = `Scraped ${data.hosts?.length || 0} hosts, ${data.organizers?.length || 0} organizers, ${data.attendees?.length || 0} attendees, & ${data.rejected?.length || 0} missed!`;
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
            list.forEach(name => {
              doc.text("- " + name, 15, yPos);
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
        addSection("Missed:", data.rejected);

        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        
        chrome.downloads.download({
          url: url,
          filename: 'attendance.pdf',
          saveAs: true
        }, () => {
          statusDiv.textContent = `Scraped ${data.hosts?.length || 0} hosts, ${data.organizers?.length || 0} organizers, ${data.attendees?.length || 0} attendees, & ${data.rejected?.length || 0} missed!`;
        });
      }
    } else {
      statusDiv.textContent = 'Failed to scrape data.';
    }
  });
}

document.getElementById('scrapeJsonBtn').addEventListener('click', () => scrapeData('json'));
document.getElementById('scrapePdfBtn').addEventListener('click', () => scrapeData('pdf'));
