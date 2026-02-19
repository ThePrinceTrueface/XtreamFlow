
// We export the worker code as a string to avoid environment specific loading issues (CORS, Bundlers)
export const FILE_WORKER_CODE = `
self.onmessage = async (e) => {
  const { file } = e.data;

  try {
    const text = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

    const json = JSON.parse(text);

    if (Array.isArray(json) || (typeof json === 'object' && json !== null)) {
       self.postMessage({ type: 'SUCCESS', data: json });
    } else {
       throw new Error("Format invalid: Expected a JSON array or backup object.");
    }

  } catch (err) {
    self.postMessage({ type: 'ERROR', error: err.message || "Failed to parse file" });
  }
};
`;
