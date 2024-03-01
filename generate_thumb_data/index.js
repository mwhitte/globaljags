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
  const finalBucket = storage.bucket('sp24-41200-mwhitte-gj-final');

  console.log(`File name: ${gcsFile.name}`);
  console.log(`Generation number: ${gcsFile.generation}`);
  console.log(`Content type: ${gcsFile.contentType}`);

  // Create a working directory on the VM that runs our GCF to download the original file
  const workingDir = path.join(os.tmpdir(), 'downloads');

  // Create a variable that holds the path to the 'local' version of the file
  const tempFilePath = path.join(workingDir, gcsFile.name);

  // Wait until the working directory is ready
  await fs.ensureDir(workingDir);

  // Download the original file to the path on the 'local' VM
  await finalBucket.file(gcsFile.name).download({
    destination: tempFilePath
  });

  console.log(`Downloaded file to: ${tempFilePath}`);

  // Delete the temp working directory and its files from the GCF's VM
  await fs.remove(workingDir);
  console.log(`Deleted temporary directory: ${workingDir}`);
};
