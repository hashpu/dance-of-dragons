/* Stores uploaded files (member avatars, application images) in the
   database instead of on local disk. Render's local filesystem gets wiped
   on every redeploy/restart — the database doesn't, so this is what keeps
   uploads around across updates. See routes/uploads.js for the route that
   serves them back out. */
const { pool } = require("./db");

function makeUploadId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function saveUpload(buffer, mimeType) {
  const id = makeUploadId();
  await pool.query("INSERT INTO uploaded_files (id, mime_type, data) VALUES ($1,$2,$3)", [id, mimeType, buffer]);
  return `/api/uploads/${id}`;
}

module.exports = { saveUpload };
