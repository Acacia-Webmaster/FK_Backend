const multer = require("multer");
const path = require("path");
const fs = require("fs");

const tempDir = path.join(__dirname, "../temp_uploads");
fs.mkdirSync(tempDir, { recursive: true });

const sanitize = (name) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, tempDir),
  filename: (_, file, cb) => {
    cb(null, sanitize(file.originalname));
  },
});

module.exports = multer({ storage });
