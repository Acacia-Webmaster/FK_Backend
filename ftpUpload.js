const ftp = require("basic-ftp");
const path = require("path");

async function uploadToHostinger(localPath, remotePath) {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: process.env.FTP_PORT || 21,
      secure: false,
    });

    await client.ensureDir(path.dirname(remotePath));
    await client.uploadFrom(localPath, remotePath);
  } finally {
    client.close();
  }
}

module.exports = { uploadToHostinger };
