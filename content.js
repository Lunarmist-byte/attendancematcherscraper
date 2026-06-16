(() => {
  const data = {
    hosts: [],
    organizers: [],
    attendees: [],
    scraped_names: [],
    time_string: "",
    class_hours: []
  };

  try {
    // 1. Scrape Time
    // Match patterns like "08:00 PM - 09:00 PM" or "Feb 16 • 08:00 PM - Feb 16 • 09:00 PM"
    const timeRegex = /((?:0?[1-9]|1[0-2]):[0-5][0-9]\s*(?:AM|PM|am|pm))\s*-\s*(?:[A-Za-z]{3}\s*\d{1,2}\s*•\s*)?((?:0?[1-9]|1[0-2]):[0-5][0-9]\s*(?:AM|PM|am|pm))/i;
    
    const bodyText = document.body.innerText;
    const match = bodyText.match(timeRegex);
    if (match) {
      data.time_string = match[0];
      data.class_hours = mapTimeToClassHours(match[1], match[2]);
    }

    function parseTime(timeStr) {
      const parts = timeStr.match(/(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM|am|pm)/i);
      if (!parts) return 0;
      let h = parseInt(parts[1], 10);
      const m = parseInt(parts[2], 10);
      const ampm = parts[3].toLowerCase();
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      return h * 60 + m;
    }

    function mapTimeToClassHours(startStr, endStr) {
      const startMins = parseTime(startStr);
      const endMins = parseTime(endStr);
      const hours = new Set();
      
      const slots = [
        { num: 1, start: 9 * 60, end: 10 * 60 },
        { num: 2, start: 10 * 60, end: 11 * 60 },
        { num: 3, start: 11 * 60 + 10, end: 12 * 60 + 10 },
        { num: 4, start: 13 * 60, end: 14 * 60 },
        { num: 5, start: 14 * 60, end: 15 * 60 },
        { num: 6, start: 15 * 60, end: 16 * 60 }
      ];

      for (const slot of slots) {
        // Strict overlap logic
        if (startMins < slot.end && endMins > slot.start) {
          hours.add(slot.num);
        }
      }
      return Array.from(hours).sort((a,b)=>a-b);
    }

    // 2. Scrape Names
    // Based on Luma structure: span with text-[10px] class
    const nameSpans = document.querySelectorAll('span[class*="text-[10px]"]');
    if (nameSpans.length > 0) {
      nameSpans.forEach(span => {
        const name = span.textContent.trim();
        if (name && !data.scraped_names.includes(name)) {
          data.scraped_names.push(name);
        }
      });
    } else {
      // Fallback: avatar siblings
      const avatars = document.querySelectorAll('img[src*="avatar"], img[src*="profile"], .rounded-full img');
      avatars.forEach(img => {
        const parent = img.closest('div[class*="flex-col"]') || img.parentElement?.parentElement;
        if (parent) {
           const textNodes = Array.from(parent.querySelectorAll('span, div, p')).filter(el => el.children.length === 0 && el.textContent.trim().length > 0 && el.textContent.trim().length < 30);
           textNodes.forEach(node => {
              const name = node.textContent.trim();
              if (name && !data.scraped_names.includes(name)) {
                data.scraped_names.push(name);
              }
           });
        }
      });
    }

    data.attendees = data.scraped_names;

  } catch (err) {
    console.error("Attendance Scraper Error:", err);
  }

  return data;
})();
