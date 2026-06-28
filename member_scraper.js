(() => {
  const members = {};
  const supabaseUpdates = [];

  const extractBackgroundUrl = (style) => {
    const match = style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
    return match ? match[1] : null;
  };

  const getSourceUrl = (el) => {
    return el.tagName === 'IMG' ? el.src : extractBackgroundUrl(el.style);
  };

  const findMemberDetails = (element) => {
    let container = element.parentElement;
    let depth = 0;
    
    while (container && depth < 5) {
      const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      let node;
      const texts = [];
      
      while ((node = walk.nextNode())) {
        const text = node.textContent.trim();
        if (text.length >= 2 && text.length <= 60 && isNaN(Number(text))) {
          texts.push(text);
        }
      }
      
      if (texts.length > 0) {
        const name = texts[0].replace(/\n/g, '').trim();
        const emailMatch = texts.find(t => /^\S+@\S+\.\S+$/.test(t));
        return {
          name,
          email: emailMatch ? emailMatch.toLowerCase() : null
        };
      }
      
      container = container.parentElement;
      depth++;
    }
    return { name: null, email: null };
  };

  const scrapeMembers = () => {
    const elements = document.querySelectorAll('img, [style*="background-image"]');
    
    elements.forEach(el => {
      const src = getSourceUrl(el);
      if (!src || src.startsWith('data:image')) return;

      const { name, email } = findMemberDetails(el);
      
      if (name && src && src.startsWith('http')) {
        members[src] = name;
        if (email) {
          if (!supabaseUpdates.some(u => u.email === email)) {
            supabaseUpdates.push({ name, email, avatar_url: src });
          }
        }
      }
    });
  };

  const updateStorage = async () => {
    const storage = await new Promise(resolve => chrome.storage.local.get(['memberDB', 'supabaseUpdates'], resolve));
    
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
  };

  const run = async () => {
    scrapeMembers();
    return await updateStorage();
  };

  return run();
})();
