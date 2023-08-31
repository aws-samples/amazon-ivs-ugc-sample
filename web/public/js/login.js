const init = () => {
  Alpine.store('form', {
    action: '/login',
  });
};

document.addEventListener('alpine:init', init);
