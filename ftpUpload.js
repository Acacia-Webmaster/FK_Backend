const ftp = require("basic-ftp");
const { Readable } = require("stream");
const path = require("path");
async function uploadToHostingerFromBuffer(buffer, remotePath) {
  console.log("🚀 FTP UPLOAD START");
  console.log("➡️ Remote path:", remotePath);

  const client = new ftp.Client();

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: process.env.FTP_PORT || 21,
      secure: false,
    });

    console.log("✅ FTP connected");

    await client.ensureDir(path.dirname(remotePath));
    console.log("📁 Directory ensured");

    const stream = Readable.from(buffer);
    await client.uploadFrom(stream, remotePath);

    console.log("✅ Upload complete");

  } catch (err) {
    console.error("❌ FTP upload failed:", err);
    throw err;
  } finally {
    client.close();
  }
}


module.exports = { uploadToHostingerFromBuffer };
