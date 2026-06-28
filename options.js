const UI = {
  supabaseUrl: document.getElementById('supabaseUrl'),
  supabaseKey: document.getElementById('supabaseKey'),
  supabaseStatus: document.getElementById('supabaseStatus'),
  saveSupabaseBtn: document.getElementById('saveSupabaseBtn'),
  
  makerClubsUrl: document.getElementById('makerClubsUrl'),
  makerClubsStatus: document.getElementById('makerClubsStatus'),
  saveMakerClubsBtn: document.getElementById('saveMakerClubsBtn'),
  
  memberDataFile: document.getElementById('memberDataFile'),
  syncMemberDataBtn: document.getElementById('syncMemberDataBtn'),
  syncStatus: document.getElementById('syncStatus')
};

const showStatus = (element, message, duration = 3000) => {
  element.textContent = message;
  setTimeout(() => { element.textContent = ''; }, duration);
};

const loadConfig = () => {
  chrome.storage.local.get(['supabaseUrl', 'supabaseKey', 'makerClubsUrl'], (config) => {
    if (config.supabaseUrl) UI.supabaseUrl.value = config.supabaseUrl;
    if (config.supabaseKey) UI.supabaseKey.value = config.supabaseKey;
    if (config.makerClubsUrl) UI.makerClubsUrl.value = config.makerClubsUrl;
    else UI.makerClubsUrl.value = 'https://maker-clubs.netlify.app'; // Default
  });
};

const saveSupabaseConfig = () => {
  const supabaseUrl = UI.supabaseUrl.value.trim();
  const supabaseKey = UI.supabaseKey.value.trim();

  chrome.storage.local.set({ supabaseUrl, supabaseKey }, () => {
    showStatus(UI.supabaseStatus, 'Connection saved securely!');
  });
};

const saveMakerClubsConfig = () => {
  const makerClubsUrl = UI.makerClubsUrl.value.trim();

  chrome.storage.local.set({ makerClubsUrl }, () => {
    showStatus(UI.makerClubsStatus, 'Maker Clubs URL saved!');
  });
};

const parseCSV = (text) => {
  const lines = text.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ? values[i].trim() : null;
    });
    return obj;
  });
};

const syncMemberData = async () => {
  const file = UI.memberDataFile.files[0];
  if (!file) {
    showStatus(UI.syncStatus, 'Please select a CSV or JSON file.');
    return;
  }

  showStatus(UI.syncStatus, 'Reading file...');
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    let data = [];
    
    try {
      if (file.name.endsWith('.json')) {
        data = JSON.parse(content);
      } else if (file.name.endsWith('.csv')) {
        data = parseCSV(content);
      } else {
        throw new Error('Unsupported format');
      }
    } catch (err) {
      showStatus(UI.syncStatus, 'Error parsing file.');
      return;
    }
    
    if (!Array.isArray(data)) {
      showStatus(UI.syncStatus, 'Data must be an array of members.');
      return;
    }

    const storage = await new Promise(res => chrome.storage.local.get(['supabaseUrl', 'supabaseKey'], res));
    if (!storage.supabaseUrl || !storage.supabaseKey) {
      showStatus(UI.syncStatus, 'Error: Configure Supabase first.');
      return;
    }

    showStatus(UI.syncStatus, 'Syncing to Supabase...');
    
    let successCount = 0;
    for (const member of data) {
      if (!member.email) continue;
      
      const updatePayload = {};
      if (member.register_number) updatePayload.register_number = member.register_number;
      if (member.roll_no) updatePayload.roll_no = member.roll_no;
      if (member.department) updatePayload.department = member.department;
      if (member.year) updatePayload.year = member.year;
      if (member.name) updatePayload.name = member.name;
      
      if (Object.keys(updatePayload).length === 0) continue;
      
      try {
        const res = await fetch(`${storage.supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(member.email)}`, {
          method: 'PATCH',
          headers: {
            'apikey': storage.supabaseKey,
            'Authorization': `Bearer ${storage.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(updatePayload)
        });
        if (res.ok) successCount++;
      } catch (err) {
        console.error("Supabase update error", err);
      }
    }
    
    showStatus(UI.syncStatus, `Sync complete! Updated ${successCount} profiles.`);
  };
  reader.readAsText(file);
};

document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  
  UI.saveSupabaseBtn.addEventListener('click', saveSupabaseConfig);
  UI.saveMakerClubsBtn.addEventListener('click', saveMakerClubsConfig);
  UI.syncMemberDataBtn.addEventListener('click', syncMemberData);
});

