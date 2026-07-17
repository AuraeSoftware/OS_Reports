const mongoose = require("mongoose");
const { Readable } = require("stream");

function getBucket(bucketName) {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });
}

/** Uploads a Buffer to a GridFS bucket, returns the new file's ObjectId (as string). */
function uploadBuffer(bucketName, filename, buffer, metadata = {}) {
  return new Promise((resolve, reject) => {
    const bucket = getBucket(bucketName);
    const uploadStream = bucket.openUploadStream(filename, { metadata });
    Readable.from(buffer).pipe(uploadStream)
      .on("error", reject)
      .on("finish", () => resolve(uploadStream.id.toString()));
  });
}

/** Downloads a GridFS file into a Buffer. */
function downloadBuffer(bucketName, fileId) {
  return new Promise((resolve, reject) => {
    const bucket = getBucket(bucketName);
    const chunks = [];
    bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId))
      .on("data", (chunk) => chunks.push(chunk))
      .on("error", reject)
      .on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function deleteFile(bucketName, fileId) {
  const bucket = getBucket(bucketName);
  await bucket.delete(new mongoose.Types.ObjectId(fileId));
}

module.exports = { uploadBuffer, downloadBuffer, deleteFile, getBucket };
