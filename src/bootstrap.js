const STORAGE_KEY = 'flock-incidents-v02';
let cloudflareBackendAvailable = false;
let syncTimer;

async function hydrateFromCloudflare() {
  try {
    const response = await fetch('/api/incidents', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const data = await response.json();
    if (Array.isArray(data.incidents) && data.incidents.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.incidents));
    }
    cloudflareBackendAvailable = true;
  } catch (error) {
    console.warn('Flock Cloudflare backend unavailable; using browser persistence.', error);
  }
}

function installCloudSync() {
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function setItem(key, value) {
    originalSetItem.call(this, key, value);
    if (this !== localStorage || key !== STORAGE_KEY || !cloudflareBackendAvailable) return;

    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      try {
        const incidents = JSON.parse(value);
        const response = await fetch('/api/incidents', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ incidents }),
        });
        if (!response.ok) throw new Error(`API returned ${response.status}`);
      } catch (error) {
        console.error('Flock failed to persist incident changes to D1.', error);
      }
    }, 250);
  };
}

await hydrateFromCloudflare();
installCloudSync();
await import('./main.jsx');
