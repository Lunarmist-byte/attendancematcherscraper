(async () => {
  const data = {
    hosts: [],
    organizers: [],
    attendees: [],
    scraped_names: [],
    appbucket_links: [],
    time_string: "",
    class_hours: [],
    event_name: "attendance"
  };

  let db = {};
  try {
    const storage = await chrome.storage.local.get(['memberDB', 'supabaseUrl', 'supabaseKey']);
    if (storage.memberDB) {
        db = storage.memberDB;
    }
    
    if (storage.supabaseUrl && storage.supabaseKey) {
        try {
            const res = await fetch(`${storage.supabaseUrl}/rest/v1/profiles?select=name,avatar_url&avatar_url=not.is.null`, {
                headers: {
                    'apikey': storage.supabaseKey,
                    'Authorization': `Bearer ${storage.supabaseKey}`
                }
            });
            if (res.ok) {
                const profiles = await res.json();
                profiles.forEach(p => {
                    if (p.avatar_url && p.name) {
                        db[p.avatar_url] = p.name;
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

  try {
    // 1. Scrape Time
    const bodyText = document.body.innerText || "";
    const allTimes = bodyText.match(/(?:0?[1-9]|1[0-2]):[0-5][0-9]\s*(?:AM|PM|am|pm)/gi);
    if (allTimes && allTimes.length >= 2) {
      data.time_string = allTimes[0] + " - " + allTimes[1];
      data.class_hours = mapTimeToClassHours(allTimes[0], allTimes[1]);
    } else {
      const lumaTimeRegex = /((?:0?[1-9]|1[0-2]):[0-5][0-9]\s*(?:AM|PM|am|pm))\s*-\s*(?:[A-Za-z]{3}\s*\d{1,2}\s*•\s*)?((?:0?[1-9]|1[0-2]):[0-5][0-9]\s*(?:AM|PM|am|pm))/i;
      const match = bodyText.match(lumaTimeRegex);
      if (match) {
        data.time_string = match[0];
        data.class_hours = mapTimeToClassHours(match[1], match[2]);
      }
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
        if (startMins < slot.end && endMins > slot.start) {
          hours.add(slot.num);
        }
      }
      return Array.from(hours).sort((a,b)=>a-b);
    }

    // 2. Scrape Event Name
    const h1 = document.querySelector('h1');
    if (h1 && h1.innerText.trim()) {
      data.event_name = h1.innerText.trim();
    } else if (document.title) {
      data.event_name = document.title.split('-')[0].trim() || document.title;
    }
    data.event_name = data.event_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    if (!data.event_name) data.event_name = "attendance";

    // 3. Scrape Names (Robust Generic Method)
    const elements = document.body.querySelectorAll('*');
    let currentCategory = 'attendees';
    const scraped = new Set();

    elements.forEach(el => {
       const txt = el.textContent ? el.textContent.toLowerCase().trim() : "";
       if (txt.length > 0 && txt.length < 25) {
           if (/^hosts?(?:\s*\d+)?$/.test(txt)) currentCategory = 'hosts';
           else if (/^(?:organizers?|co-hosts?)(?:\s*\d+)?$/.test(txt)) currentCategory = 'organizers';
           else if (/^(?:attendees?|guests?)(?:\s*\d+)?$/.test(txt)) currentCategory = 'attendees';
       }

       if (el.tagName === 'IMG') {
           const img = el;
           const rect = img.getBoundingClientRect();
           
           if (rect.width === 0 || rect.height === 0 || rect.width > 150 || rect.height > 150) return;
           const aspectRatio = rect.width / rect.height;
           if (aspectRatio < 0.7 || aspectRatio > 1.3) return;

           let container = img.parentElement;
           let name = "";
           let profile_link = "";
           let depth = 0;
           
           const imgLink = img.closest('a');
           if (imgLink && imgLink.href) {
               profile_link = imgLink.href;
           }
           
           while (container && depth < 4) {
             let texts = [];
             container.childNodes.forEach(node => {
               if (node.nodeType === Node.TEXT_NODE) {
                 const t = node.textContent.trim();
                 if (t.length >= 2 && t.length <= 30 && isNaN(Number(t))) texts.push({ txt: t, node: node });
               }
             });
             container.querySelectorAll('*').forEach(node => {
               if (node.children.length === 0) {
                 const t = node.textContent.trim();
                 if (t.length >= 2 && t.length <= 30 && isNaN(Number(t))) texts.push({ txt: t, node: node });
               }
             });

             for (let item of texts) {
               const lower = item.txt.toLowerCase();
               const ignore = ['hosts', 'organizers', 'attendees', 'guests', 'missed', 'approved', 'rejected', 'going', 'not going', 'location', 'anywhere', 'photos', 'audience'];
               if (!ignore.includes(lower) && !/^[^\w\s]+$/.test(lower)) {
                 name = item.txt;
                 if (!profile_link && item.node && item.node.nodeType === Node.ELEMENT_NODE) {
                     const a = item.node.closest('a');
                     if (a && a.href) profile_link = a.href;
                 } else if (!profile_link && item.node && item.node.nodeType === Node.TEXT_NODE) {
                     const a = item.node.parentElement.closest('a');
                     if (a && a.href) profile_link = a.href;
                 }
                 break;
               }
             }

             if (!profile_link && container.tagName === 'A' && container.href) {
                 profile_link = container.href;
             }

             if (name) break;
             container = container.parentElement;
             depth++;
           }

             if (name && !scraped.has(img.src + name)) {
                 if (db[img.src]) {
                     name = db[img.src];
                 } else {
                     const baseSrc = img.src.split('?')[0];
                     const matchedKey = Object.keys(db).find(k => k.startsWith(baseSrc));
                     if (matchedKey) name = db[matchedKey];
                 }

                 scraped.add(img.src + name);
                 const person = { name, avatar_url: img.src, profile_link };
                 data[currentCategory].push(person);
                 data.scraped_names.push(person);
             }
       }
    });

    // Luma fallback
    if (data.scraped_names.length === 0) {
      const nameSpans = document.querySelectorAll('span[class*="text-[10px]"]');
      nameSpans.forEach(span => {
        const name = span.textContent.trim();
        const parent = span.closest('div[class*="flex-col"]') || span.parentElement?.parentElement;
        
        let avatar_url = null;
        if (parent) {
          const avatarSpan = parent.querySelector('span[class*="AvatarStyles"]');
          if (avatarSpan) {
            const innerImg = avatarSpan.querySelector('img');
            if (innerImg && innerImg.src) avatar_url = innerImg.src;
            else {
              const style = avatarSpan.getAttribute('style') || '';
              const bgMatch = style.match(/url\(['"]?(.*?)['"]?\)/);
              if (bgMatch) avatar_url = bgMatch[1];
            }
          }
        }
        
        if (name && !data.scraped_names.some(n => n.name === name)) {
          if (avatar_url && db[avatar_url]) {
             name = db[avatar_url];
          } else if (avatar_url) {
             const baseSrc = avatar_url.split('?')[0];
             const matchedKey = Object.keys(db).find(k => k.startsWith(baseSrc));
             if (matchedKey) name = db[matchedKey];
          }

          const person = { name, avatar_url };
          data.scraped_names.push(person);
          data.attendees.push(person);
        }
      });
    }

  } catch (err) {
    console.error("Attendance Scraper Error:", err);
  }

  return data;
})();
