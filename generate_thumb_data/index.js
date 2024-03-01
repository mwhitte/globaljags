// Imports
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const sharp = require('sharp');

// Entry point function
exports.generate_thumb_data = async (file, context) => {
  const gcsFile = file;
  const storage = new Storage();
  const sourceBucket = storage.bucket(gcsFile.bucket);
  const thumbnailsBucket = storage.bucket('sp24-41200-mwhitte-gj-thumbnails');
  const finalBucket = storage.bucket('sp24-41200-mwhitte-gj-final');

  console.log(`File name: ${gcsFile.name}`);
  console.log(`Generation number: ${gcsFile.generation}`);
  console.log(`Content type: ${gcsFile.contentType}`);

  // Reject images that are not jpeg or png files
  let fileExtension = '';
  let validFile = false;

  if (gcsFile.contentType === 'image/jpeg') {
    console.log('This is a JPG file.');
    fileExtension = 'jpg';
    validFile = true;
  } else if (gcsFile.contentType === 'image/png') {
    console.log('This is a PNG file.');
    fileExtension = 'png';
    validFile = true;
  } else {
    console.log('This is not a valid file. Deleting file.');
    await sourceBucket.file(gcsFile.name).delete();
    return;
  }

  // If the file is a valid photograph, download it to the 'local' VM
  if (validFile) {
    // Create a new filename for the 'final' version of the image file
    const finalFileName = `${gcsFile.generation}.${fileExtension}`;

    // Create a working directory on the VM to download the original file
    const workingDir = path.join(os.tmpdir(), 'thumbs');
    const tempFilePath = path.join(workingDir, finalFileName);

    // Wait until the working directory is ready
    await fs.ensureDir(workingDir);

    // Download the original file to the path on the 'local' VM
    await sourceBucket.file(gcsFile.name).download({
      destination: tempFilePath
    });

    // Upload the local version to the final images bucket
    await finalBucket.upload(tempFilePath);

    // Create a name for the thumbnail image
    const thumbName = `thumb@64_${finalFileName}`;
    const thumbPath = path.join(workingDir, thumbName);

    // Use sharp to generate the thumbnail image and save it
    await fs.ensureDir(workingDir);
    await sharp(tempFilePath).resize(64).withMetadata().toFile(thumbPath).then(async () => {
      await thumbnailsBucket.upload(thumbPath);
    });

    // Delete the temp working directory and its files from the GCF's VM
    await fs.remove(workingDir);
  }

  // Delete the original file uploaded to the "Uploads" bucket
  await sourceBucket.file(gcsFile.name).delete();
  console.log(`Deleted uploaded file: ${gcsFile.name}`);
};