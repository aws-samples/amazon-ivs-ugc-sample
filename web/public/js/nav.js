document.addEventListener('DOMContentLoaded', () => {
  const isDarkMode = localStorage.getItem('streamcat-dark-mode') === 'true';
  document.querySelector('body').setAttribute('data-bs-theme', isDarkMode ? 'dark' : 'light');
  window.addEventListener('darkModeChanged', (evt) => {
    document.querySelector('body').setAttribute('data-bs-theme', evt.detail.isDarkMode ? 'dark' : 'light');
    localStorage.setItem('streamcat-dark-mode', evt.detail.isDarkMode);
  });
});
