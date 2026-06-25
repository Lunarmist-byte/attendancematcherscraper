document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('supabaseUrl');
  const keyInput = document.getElementById('supabaseKey');
  const statusDiv = document.getElementById('status');

  chrome.storage.local.get(['supabaseUrl', 'supabaseKey'], (result) => {
    if (result.supabaseUrl) urlInput.value = result.supabaseUrl;
    if (result.supabaseKey) keyInput.value = result.supabaseKey;
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const supabaseUrl = urlInput.value.trim();
    const supabaseKey = keyInput.value.trim();

    chrome.storage.local.set({ supabaseUrl, supabaseKey }, () => {
      statusDiv.textContent = 'Configuration saved securely!';
      setTimeout(() => { statusDiv.textContent = ''; }, 3000);
    });
  });
});
