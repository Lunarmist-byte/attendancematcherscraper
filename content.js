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

  const matchMemberFromDB = (src, db) => {
    if (!src) return null;
    if (db[src]) return db[src];

    let decodedSrc = src;
    try { decodedSrc = decodeURIComponent(src); } catch (e) {}
    
    for (const [key, value] of Object.entries(db)) {
      const dbBase = key.split('?')[0];
      const srcBase = decodedSrc.split('?')[0];
      
      if (srcBase.includes(dbBase) || dbBase.includes(srcBase)) {
        return value;
      }
      
      const dbFile = dbBase.split('/').pop();
      const srcFile = srcBase.split('/').pop();
      
      if (dbFile && dbFile.length > 10 && dbFile === srcFile) {
        return value;
      }
      
      if (srcBase.includes('appbucket') || dbBase.includes('appbucket')) {
        const srcBucketPart = srcBase.split('appbucket')[1];
        const dbBucketPart = dbBase.split('appbucket')[1];
        if (srcBucketPart && dbBucketPart && srcBucketPart === dbBucketPart) {
          return value;
        }
      }
    }
    return null;
  };

  const loadDatabase = async () => {
    let db = {};
    try {
      const storage = await chrome.storage.local.get(['memberDB', 'supabaseUrl', 'supabaseKey']);
      if (storage.memberDB) db = storage.memberDB;
      
      if (storage.supabaseUrl && storage.supabaseKey) {
        try {
          const res = await fetch(`${storage.supabaseUrl}/rest/v1/profiles?select=name,avatar_url,register_number,roll_no,department,year&avatar_url=not.is.null`, {
            headers: {
              'apikey': storage.supabaseKey,
              'Authorization': `Bearer ${storage.supabaseKey}`
            }
          });
          if (res.ok) {
            const profiles = await res.json();
            profiles.forEach(p => {
              if (p.avatar_url && p.name) {
                db[p.avatar_url] = {
                  name: p.name,
                  register_number: p.register_number,
                  roll_no: p.roll_no,
                  department: p.department,
                  year: p.year
                };
              }
            });
          }
        } catch (e) {
          console.warn("Could not fetch Supabase profiles", e);
        }
      }
      
      try {
        const dbUrl = chrome.runtime.getURL('db.json');
        const dbRes = await fetch(dbUrl);
        const jsonDb = await dbRes.json();
        db = { ...jsonDb, ...db };
      } catch (e) {}
    } catch (e) {
      console.warn("Could not load db from storage", e);
    }
    return db;
  };

  const parseEventTime = () => {
    const timeRegex = /((?:0?[1-9]|1[0-2]):[0-5][0-9]\s*(?:AM|PM|am|pm))\s*-\s*(?:[A-Za-z]{3}\s*\d{1,2}\s*•\s*)?((?:0?[1-9]|1[0-2]):[0-5][0-9]\s*(?:AM|PM|am|pm))/i;
    const match = document.body.innerText.match(timeRegex);
    if (match) {
      data.time_string = match[0];
      data.class_hours = mapTimeToClassHours(match[1], match[2]);
    }
  };

  const parseTime = (timeStr) => {
    const parts = timeStr.match(/(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM|am|pm)/i);
    if (!parts) return 0;
    let h = parseInt(parts[1], 10);
    const m = parseInt(parts[2], 10);
    const ampm = parts[3].toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return h * 60 + m;
  };

  const mapTimeToClassHours = (startStr, endStr) => {
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
      if (startMins < slot.end && endMins > slot.start) {
        hours.add(slot.num);
      }
    }
    return Array.from(hours).sort((a, b) => a - b);
  };

  const getCategory = (node) => {
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
    let container = node.closest('div[class*="flex-col"]') || node.closest('div[class*="flex"]');
    if (container && container.textContent.length < 500) {
      let text = container.textContent.toLowerCase();
      if (text.includes('missed')) return 'rejected';
      if (text.includes('hosts')) return 'hosts';
      if (text.includes('organizers')) return 'organizers';
    }
    return 'attendees';
  };

  const getEventName = () => {
    const h1 = document.querySelector('h1');
    if (h1 && h1.innerText.trim()) {
      return h1.innerText.trim();
    }
    if (document.title) {
      return document.title.split('-')[0].trim() || document.title;
    }
    return "";
  };
  
  const addMemberToData = (memberData, category, cleanEventName) => {
    const nameStr = typeof memberData === 'object' ? memberData.name : memberData;
    if (!nameStr || nameStr.toLowerCase() === cleanEventName) return;

    const list = data[category];
    const exists = list.some(item => (typeof item === 'object' ? item.name : item) === nameStr);
    
    if (!exists) {
      list.push(memberData);
    }
    
    if (!data.scraped_names.includes(nameStr)) {
      data.scraped_names.push(nameStr);
    }
  };

  const extractBackgroundUrl = (style) => {
    const match = style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
    return match ? match[1] : null;
  };

  const runScraper = async () => {
    const db = await loadDatabase();
    
    try {
      parseEventTime();
      data.raw_event_name = getEventName();
      data.event_name = data.raw_event_name;
      const cleanEventName = data.raw_event_name.toLowerCase();

      const nameSpans = document.querySelectorAll('span[class*="text-[10px]"]');
      if (nameSpans.length > 0) {
        nameSpans.forEach(span => {
          let memberData = span.textContent.trim();
          let container = span.closest('div[class*="flex"]') || span.parentElement?.parentElement;
          
          let avatarUrl = null;
          if (container) {
            const img = container.querySelector('img');
            if (img && img.src) avatarUrl = img.src;
            if (!avatarUrl) {
              const avatarDiv = container.querySelector('[style*="background-image"]');
              if (avatarDiv) avatarUrl = extractBackgroundUrl(avatarDiv.style);
            }
          
            if (img && img.alt && img.alt.trim()) {
              const altName = img.alt.trim().replace(/'s avatar$/i, '').trim();
              if (altName.length > memberData.length) memberData = altName;
            } else if (span.title && span.title.trim()) {
              memberData = span.title.trim();
            } else if (container.title && container.title.trim()) {
              memberData = container.title.trim();
            }
          }

          if (avatarUrl) {
            const matchedMember = matchMemberFromDB(avatarUrl, db);
            if (matchedMember) memberData = matchedMember;
          }

          const category = getCategory(container || span);
          addMemberToData(memberData, category, cleanEventName);
        });
      } else {
        const avatars = document.querySelectorAll('img[src*="avatar"], img[src*="profile"], .rounded-full img, [style*="background-image"]');
        avatars.forEach(el => {
          let avatarUrl = el.tagName === 'IMG' ? el.src : extractBackgroundUrl(el.style);
          if (!avatarUrl || avatarUrl.startsWith('data:image')) return;

          const parent = el.closest('div[class*="flex-col"]') || el.closest('div[class*="flex"]') || el.parentElement?.parentElement;
          if (parent) {
             let memberData = null;
             
             if (el.tagName === 'IMG' && el.alt && el.alt.trim()) {
               let altName = el.alt.trim().replace(/'s avatar$/i, '').trim();
               if (altName && !['missed', 'approved', 'checked in', 'going', 'not going'].includes(altName.toLowerCase())) {
                 memberData = altName;
               }
             }

             if (!memberData) {
               const textNodes = Array.from(parent.querySelectorAll('span, div, p')).filter(node => node.children.length === 0 && node.textContent.trim().length > 0 && node.textContent.trim().length < 30);
               for (let node of textNodes) {
                 let name = node.textContent.trim();
                 if (node.title && node.title.trim().length > name.length) {
                   name = node.title.trim();
                 }
                 if (name && !['missed', 'approved', 'checked in', 'going', 'not going'].includes(name.toLowerCase())) {
                   memberData = name;
                   break;
                 }
               }
             }

             const matchedMember = matchMemberFromDB(avatarUrl, db);
             if (matchedMember) memberData = matchedMember;

             const category = getCategory(parent || el);
             addMemberToData(memberData, category, cleanEventName);
          }
        });
      }
    } catch (err) {
      console.error("Attendance Scraper Error:", err);
    }
    return data;
  };

  return runScraper();
})();
