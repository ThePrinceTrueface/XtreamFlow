
// We export the worker code as a string to avoid environment specific loading issues (CORS, Bundlers)
export const XTREAM_WORKER_CODE = `
let cachedData = [];

self.onmessage = async (e) => {
  const { type, payload, id } = e.data;

  try {
    switch (type) {
      case 'FETCH_AND_GROUP':
        // Payload: { url: string, limit: number }
        const response = await fetch(payload.url);
        if (!response.ok) throw new Error("HTTP " + response.status);
        
        const data = await response.json();
        cachedData = Array.isArray(data) ? data : [];

        // Grouping for "Home" view (limit items per category)
        const grouped = {};
        const limit = payload.limit || 15;

        cachedData.forEach((item) => {
            const catId = item.category_id;
            if (!catId) return;
            if (!grouped[catId]) grouped[catId] = [];
            if (grouped[catId].length < limit) {
                grouped[catId].push(item);
            }
        });

        self.postMessage({ type: 'SUCCESS', id, data: { full: cachedData, grouped } });
        break;

      case 'FILTER':
        const q = payload.query.toLowerCase();
        const filtered = cachedData.filter((item) => {
            const name = item.name || item.title || "";
            return name.toLowerCase().includes(q);
        });
        self.postMessage({ type: 'FILTER_RESULT', id, data: filtered });
        break;

      default:
        break;
    }
  } catch (err) {
    self.postMessage({ type: 'ERROR', id, error: err.message });
  }
};
`;
