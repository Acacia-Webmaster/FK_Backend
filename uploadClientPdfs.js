const multer = require("multer");

module.exports = multer({
  storage: multer.memoryStorage(), // ✅ SERVERLESS SAFE
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
