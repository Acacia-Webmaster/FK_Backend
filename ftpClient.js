const ftp = require('basic-ftp');

async function uploadToFTP({
  host,
  user,
  password,
  remoteDir,
  filename,
  buffer
}) {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host,
      user,
      password,
      secure: false
    });

    await client.ensureDir(remoteDir);
    await client.uploadFrom(buffer, `${remoteDir}/${filename}`);
  } finally {
    client.close();
  }
}

module.exports = uploadToFTP;
