(async () => {
  const members = {};
  const supabaseUpdates = [];
  
  // Find all images
  const imgs = document.querySelectorAll('img');
  imgs.forEach(img => {
    let container = img.parentElement;
    let depth = 0;
    let name = "";
    let email = "";
    
    while (container && depth < 5) {
      // Find all text nodes within container
      const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      let n;
      const texts = [];
      while (n = walk.nextNode()) {
        const t = n.textContent.trim();
        if (t.length >= 2 && t.length <= 60 && isNaN(Number(t))) {
          texts.push(t);
        }
      }
      
      // The first valid text node is usually the name.
      if (texts.length > 0) {
        name = texts[0].replace(/\n/g, '').trim();
        const emailMatch = texts.find(t => /^\S+@\S+\.\S+$/.test(t));
        if (emailMatch) {
            email = emailMatch.toLowerCase();
        }
        break;
      }
      container = container.parentElement;
      depth++;
    }
    
    if (name && img.src && img.src.startsWith('http')) {
        members[img.src] = name;
        if (email) {
            if (!supabaseUpdates.some(u => u.email === email)) {
                supabaseUpdates.push({ name, email, avatar_url: img.src });
            }
        }
    }
  });

  // Save to storage and merge with existing
  const storage = await new Promise(resolve => chrome.storage.local.get(['memberDB', 'supabaseUpdates', 'supabaseUrl', 'supabaseKey'], resolve));
  const newDb = { ...(storage.memberDB || {}), ...members };
  
  const existingUpdates = storage.supabaseUpdates || [];
  const updatesMap = new Map();
  existingUpdates.forEach(u => updatesMap.set(u.email, u));
  supabaseUpdates.forEach(u => updatesMap.set(u.email, u));
  const mergedUpdates = Array.from(updatesMap.values());

  await new Promise(resolve => chrome.storage.local.set({ memberDB: newDb, supabaseUpdates: mergedUpdates }, resolve));

  return { 
    count: Object.keys(members).length, 
    total: Object.keys(newDb).length,
    newUpdatesCount: supabaseUpdates.length,
    totalUpdatesCount: mergedUpdates.length
  };
})();
