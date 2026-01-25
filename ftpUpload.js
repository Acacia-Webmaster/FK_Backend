const ftp = require("basic-ftp");
const { Readable } = require("stream");
const path = require("path");

async function uploadToHostingerFromBuffer(buffer, remotePath) {
  const client = new ftp.Client();

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: process.env.FTP_PORT || 21,
      secure: false,
    });

    await client.ensureDir(path.dirname(remotePath));

    const stream = Readable.from(buffer);
    await client.uploadFrom(stream, remotePath);

  } finally {
    client.close();
  }
}

module.exports = { uploadToHostingerFromBuffer };
