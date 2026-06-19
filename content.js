(() => {
  const data = {
    hosts: [],
    organizers: [],
    attendees: [],
    scraped_names: [],
    rejected: [],
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
    function getCategory(node) {
      let current = node;
      while (current && current !== document.body) {
        let sibling = current.previousElementSibling;
        while (sibling) {
          let text = sibling.textContent.toLowerCase().trim();
          if (text.includes('missed')) return 'rejected';
          if (text.includes('hosts')) return 'hosts';
          if (text.includes('organizers')) return 'organizers';
          if (text.includes('attendees')) return 'attendees';
          sibling = sibling.previousElementSibling;
        }
        current = current.parentElement;
      }
      // Fallback to text content if it's a small container
      let container = node.closest('div[class*="flex-col"]') || node.closest('div[class*="flex"]');
      if (container && container.textContent.length < 500) {
          let text = container.textContent.toLowerCase();
          if (text.includes('missed')) return 'rejected';
          if (text.includes('hosts')) return 'hosts';
          if (text.includes('organizers')) return 'organizers';
      }
      return 'attendees';
    }

    // Based on Luma structure: span with text-[10px] class
    const nameSpans = document.querySelectorAll('span[class*="text-[10px]"]');
    if (nameSpans.length > 0) {
      nameSpans.forEach(span => {
        let name = span.textContent.trim();
        let container = span.closest('div[class*="flex"]') || span.parentElement?.parentElement;
        
        // Attempt to extract full name from hidden attributes to avoid pinging
        if (container) {
          const img = container.querySelector('img');
          if (img && img.alt && img.alt.trim()) {
            const altName = img.alt.trim().replace(/'s avatar$/i, '').trim();
            // Prefer the alt name if it's longer (likely the full name)
            if (altName.length > name.length) name = altName;
          } else if (span.title && span.title.trim()) {
            name = span.title.trim();
          } else if (container.title && container.title.trim()) {
            name = container.title.trim();
          }
        }

        if (name) {
          let category = getCategory(container || span);
          if (category === 'rejected') {
             if (!data.rejected.includes(name)) data.rejected.push(name);
          } else if (category === 'hosts') {
             if (!data.hosts.includes(name)) data.hosts.push(name);
          } else if (category === 'organizers') {
             if (!data.organizers.includes(name)) data.organizers.push(name);
          } else {
             if (!data.attendees.includes(name)) data.attendees.push(name);
          }
        }
      });
    } else {
      // Fallback: avatar siblings
      const avatars = document.querySelectorAll('img[src*="avatar"], img[src*="profile"], .rounded-full img');
      avatars.forEach(img => {
        const parent = img.closest('div[class*="flex-col"]') || img.closest('div[class*="flex"]') || img.parentElement?.parentElement;
        if (parent) {
           
           let nameToUse = null;
           
           // 1. Try to extract full name from image alt text
           if (img.alt && img.alt.trim()) {
             let altName = img.alt.trim().replace(/'s avatar$/i, '').trim();
             if (altName && !['missed', 'approved', 'checked in', 'going', 'not going'].includes(altName.toLowerCase())) {
               nameToUse = altName;
             }
           }

           // 2. If no alt text, fallback to parsing text nodes
           if (!nameToUse) {
             const textNodes = Array.from(parent.querySelectorAll('span, div, p')).filter(el => el.children.length === 0 && el.textContent.trim().length > 0 && el.textContent.trim().length < 30);
             for (let node of textNodes) {
               let name = node.textContent.trim();
               if (node.title && node.title.trim().length > name.length) {
                 name = node.title.trim();
               }
               if (name && !['missed', 'approved', 'checked in', 'going', 'not going'].includes(name.toLowerCase())) {
                 nameToUse = name;
                 break; // Found the first likely name
               }
             }
           }

           if (nameToUse) {
             let category = getCategory(parent || img);
             if (category === 'rejected') {
               if (!data.rejected.includes(nameToUse)) data.rejected.push(nameToUse);
             } else if (category === 'hosts') {
               if (!data.hosts.includes(nameToUse)) data.hosts.push(nameToUse);
             } else if (category === 'organizers') {
               if (!data.organizers.includes(nameToUse)) data.organizers.push(nameToUse);
             } else {
               if (!data.attendees.includes(nameToUse)) data.attendees.push(nameToUse);
             }
           }
        }
      });
    }

  } catch (err) {
    console.error("Attendance Scraper Error:", err);
  }

  return data;
})();
