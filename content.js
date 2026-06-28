(() => {
  const data = {
    hosts: [],
    organizers: [],
    attendees: [],
    scraped_names: [],
    rejected: [],
    time_string: "",
    class_hours: ""
  };

  const matchNameFromDB = (src, db) => {
    if (!src) return null;
    if (db[src]) return db[src];

    let decodedSrc = src;
    try { decodedSrc = decodeURIComponent(src); } catch(e) {}
    
    for (const key of Object.keys(db)) {
        const dbBase = key.split('?')[0];
        const srcBase = decodedSrc.split('?')[0];
        
        if (srcBase.includes(dbBase) || dbBase.includes(srcBase)) {
            return db[key];
        }
        
        const dbParts = dbBase.split('/');
        const srcParts = srcBase.split('/');
        const dbFile = dbParts[dbParts.length - 1];
        const srcFile = srcParts[srcParts.length - 1];
        
        if (dbFile && dbFile.length > 10 && dbFile === srcFile) {
            return db[key];
        }
        
        if (srcBase.includes('appbucket') || dbBase.includes('appbucket')) {
            const srcBucketPart = srcBase.split('appbucket')[1];
            const dbBucketPart = dbBase.split('appbucket')[1];
            if (srcBucketPart && dbBucketPart && srcBucketPart === dbBucketPart) {
                return db[key];
            }
        }
    }
    return null;
  }

  function matchNameByName(name, db) {
    if (!name || typeof name !== 'string') return null;
    let searchName = name.toLowerCase().trim();
    searchName = searchName.replace(/\s*\(.*\)\s*/g, '').trim();
    if (searchName.length < 2) return null;

    for (const dbName of Object.values(db)) {
      if (typeof dbName !== 'string') continue;
      const lowerDbName = dbName.toLowerCase().trim();
      if (lowerDbName === searchName) return dbName;
    }
    for (const dbName of Object.values(db)) {
      if (typeof dbName !== 'string') continue;
      const lowerDbName = dbName.toLowerCase().trim();
      if (lowerDbName.startsWith(searchName + ' ')) return dbName;
    }
    for (const dbName of Object.values(db)) {
      if (typeof dbName !== 'string') continue;
      const lowerDbName = dbName.toLowerCase().trim();
      if (lowerDbName.startsWith(searchName)) return dbName;
    }
    for (const dbName of Object.values(db)) {
      if (typeof dbName !== 'string') continue;
      const lowerDbName = dbName.toLowerCase().trim();
      if (lowerDbName.includes(searchName)) return dbName;
    }
    return null;
  };

  const runScraper = async () => {
      let db = {};
      try {
        const storage = await chrome.storage.local.get(['memberDB', 'supabaseUrl', 'supabaseKey']);
        if (storage.memberDB) db = storage.memberDB;
        
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
                        if (p.avatar_url && p.name) db[p.avatar_url] = p.name;
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
        const timeRegex = /((?:[01]?[0-9]|2[0-3]):[0-5][0-9](?:\s*(?:AM|PM|am|pm))?)\s*(?:-|–|—|to)\s*(?:[A-Za-z]{3,}\s*\d{1,2}\s*[^a-zA-Z0-9]\s*)?((?:[01]?[0-9]|2[0-3]):[0-5][0-9](?:\s*(?:AM|PM|am|pm))?)/i;
        const bodyText = document.body.innerText;
        const match = bodyText.match(timeRegex);
        if (match) {
          data.time_string = match[0].replace(/\s+/g, ' ').trim();
          const hoursArr = mapTimeToClassHours(match[1], match[2]);
          data.class_hours = hoursArr.length > 0 ? `${hoursArr.join(",")} hr` : "";
        }

        function parseTime(timeStr, defaultAmPm = 'am') {
          const parts = timeStr.match(/([01]?[0-9]|2[0-3]):([0-5][0-9])(?:\s*(AM|PM|am|pm))?/i);
          if (!parts) return 0;
          let h = parseInt(parts[1], 10);
          const m = parseInt(parts[2], 10);
          const ampm = (parts[3] || defaultAmPm).toLowerCase();
          if (ampm === 'pm' && h < 12) h += 12;
          if (ampm === 'am' && h === 12) h = 0;
          return h * 60 + m;
        }

        function mapTimeToClassHours(startStr, endStr) {
          const endAmPmMatch = endStr.match(/(AM|PM|am|pm)/i);
          const endAmPm = endAmPmMatch ? endAmPmMatch[1] : 'pm';
          const startMins = parseTime(startStr, endAmPm);
          const endMins = parseTime(endStr, endAmPm);
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
          let container = node.closest('div[class*="flex-col"]') || node.closest('div[class*="flex"]');
          if (container && container.textContent.length < 500) {
              let text = container.textContent.toLowerCase();
              if (text.includes('missed')) return 'rejected';
              if (text.includes('hosts')) return 'hosts';
              if (text.includes('organizers')) return 'organizers';
          }
          return 'attendees';
        }

        const h1 = document.querySelector('h1');
        if (h1 && h1.innerText.trim()) {
          data.raw_event_name = h1.innerText.trim();
          data.event_name = data.raw_event_name;
        } else if (document.title) {
          data.raw_event_name = document.title.split('-')[0].trim() || document.title;
          data.event_name = data.raw_event_name;
        }
        const cleanEventName = data.raw_event_name ? data.raw_event_name.toLowerCase() : "";

        const nameSpans = document.querySelectorAll('span[class*="text-[10px]"]');
        if (nameSpans.length > 0) {
          nameSpans.forEach(span => {
            let name = span.textContent.trim();
            let container = span.closest('div[class*="flex"]') || span.parentElement?.parentElement;
            
            let avatarUrl = null;
            if (container) {
              const img = container.querySelector('img');
              if (img && img.src) avatarUrl = img.src;
              if (!avatarUrl) {
                  const avatarDiv = container.querySelector('[style*="background-image"]');
                  if (avatarDiv) {
                      const bgMatch = avatarDiv.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
                      if (bgMatch) avatarUrl = bgMatch[1];
                  }
              }
            
              if (img && img.alt && img.alt.trim()) {
                const altName = img.alt.trim().replace(/'s avatar$/i, '').trim();
                if (altName.length > name.length) name = altName;
              } else if (span.title && span.title.trim()) {
                name = span.title.trim();
              } else if (container.title && container.title.trim()) {
                name = container.title.trim();
              }
            }

            if (avatarUrl) {
                const dbName = matchNameFromDB(avatarUrl, db);
                if (dbName) name = dbName;
            }
            if (name) {
                const matchedByName = matchNameByName(name, db);
                if (matchedByName) name = matchedByName;
            }

            if (name && name.toLowerCase() !== cleanEventName) {
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
              data.scraped_names.push(name);
            }
          });
        } else {
          const avatars = document.querySelectorAll('img[src*="avatar"], img[src*="profile"], .rounded-full img, [style*="background-image"]');
          avatars.forEach(el => {
            let avatarUrl = null;
            if (el.tagName === 'IMG') {
                avatarUrl = el.src;
            } else {
                const bgMatch = el.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
                if (bgMatch) avatarUrl = bgMatch[1];
            }
            if (!avatarUrl || avatarUrl.startsWith('data:image')) return;

            const parent = el.closest('div[class*="flex-col"]') || el.closest('div[class*="flex"]') || el.parentElement?.parentElement;
            if (parent) {
               let nameToUse = null;
               
               if (el.tagName === 'IMG' && el.alt && el.alt.trim()) {
                 let altName = el.alt.trim().replace(/'s avatar$/i, '').trim();
                 if (altName && !['missed', 'approved', 'checked in', 'going', 'not going'].includes(altName.toLowerCase())) {
                   nameToUse = altName;
                 }
               }

               if (!nameToUse) {
                 const textNodes = Array.from(parent.querySelectorAll('span, div, p')).filter(node => node.children.length === 0 && node.textContent.trim().length > 0 && node.textContent.trim().length < 30);
                 for (let node of textNodes) {
                   let name = node.textContent.trim();
                   if (node.title && node.title.trim().length > name.length) {
                     name = node.title.trim();
                   }
                   if (name && !['missed', 'approved', 'checked in', 'going', 'not going'].includes(name.toLowerCase())) {
                     nameToUse = name;
                     break;
                   }
                 }
               }

               const dbName = matchNameFromDB(avatarUrl, db);
               if (dbName) nameToUse = dbName;
               if (nameToUse) {
                 const matchedByName = matchNameByName(nameToUse, db);
                 if (matchedByName) nameToUse = matchedByName;
               }

               if (nameToUse && nameToUse.toLowerCase() !== cleanEventName) {
                 let category = getCategory(parent || el);
                 if (category === 'rejected') {
                   if (!data.rejected.includes(nameToUse)) data.rejected.push(nameToUse);
                 } else if (category === 'hosts') {
                   if (!data.hosts.includes(nameToUse)) data.hosts.push(nameToUse);
                 } else if (category === 'organizers') {
                   if (!data.organizers.includes(nameToUse)) data.organizers.push(nameToUse);
                 } else {
                   if (!data.attendees.includes(nameToUse)) data.attendees.push(nameToUse);
                 }
                 data.scraped_names.push(nameToUse);
               }
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
