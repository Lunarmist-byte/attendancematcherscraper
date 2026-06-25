document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // Theme Management
  const themeToggle = document.getElementById('themeToggle');
  const root = document.documentElement;

  // Load saved theme
  chrome.storage.local.get(['theme'], (result) => {
    const savedTheme = result.theme || 'light';
    root.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
  });

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = root.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      
      root.setAttribute('data-theme', newTheme);
      chrome.storage.local.set({ theme: newTheme });
      updateThemeIcon(newTheme);
    });
  }

  function updateThemeIcon(theme) {
    if (!themeToggle || !window.lucide) return;
    
    // Clear button content
    themeToggle.innerHTML = '';
    
    // Create new icon element
    const iconElement = document.createElement('i');
    iconElement.setAttribute('data-lucide', theme === 'light' ? 'moon' : 'sun');
    themeToggle.appendChild(iconElement);
    
    // Re-initialize this specific icon
    lucide.createIcons({
      attrs: {
        class: "lucide-icon"
      },
      nameAttr: 'data-lucide',
      root: themeToggle
    });
  }
});
