// The bytes a filesystem's IndexedDB actually holds for file contents
// (fs.js): the sum, over its file records, of each stored typed array's WHOLE
// underlying buffer — what structured clone keeps, whatever the view. A test
// compares it with the bytes it wrote to catch files stored as windows onto
// something larger.
export async function storedFileBytes(idb, name) {
  const db = await new Promise((resolve, reject) => {
    const request = idb.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const total = await new Promise((resolve, reject) => {
    let sum = 0;
    const cursor = db.transaction(`${name}_files`, 'readonly').objectStore(`${name}_files`).openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (!c) return resolve(sum);
      if (ArrayBuffer.isView(c.value)) sum += c.value.buffer.byteLength;
      c.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
  db.close();
  return total;
}
