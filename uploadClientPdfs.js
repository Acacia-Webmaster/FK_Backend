const multer = require("multer");
const fs = require("fs");
const path = require("path");

const baseUploadPath = process.env.FTP_BASE_DIR;

if (!baseUploadPath) {
  throw new Error("UPLOAD_BASE_PATH is not defined");
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    // clientId may not exist yet → temp folder
    const tmpDir = path.join(baseUploadPath, "tmp");

    fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },

  filename(req, file, cb) {
    // ✅ KEEP ORIGINAL NAME
    cb(null, file.originalname);
  },
});

module.exports = multer({
  storage,
  fileFilter(req, file, cb) {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files allowed"));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});
