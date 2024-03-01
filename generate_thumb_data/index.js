// Imports
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const sharp = require('sharp');
const getExif = require('exif-async');
const parseDMS = require('parse-dms');

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

    // Use exif-async and parse-dms libraries
    try {
      // Read EXIF data from the downloaded image file
      let exifData = await readExifData(tempFilePath);

      // Convert latitude and longitude from EXIF into decimal numbers
      let gpsDecimal = getGPSCoordinates(exifData);

      // Log the latitude and longitude to the console
      console.log(`Latitude: ${gpsDecimal.lat}`);
      console.log(`Longitude: ${gpsDecimal.lon}`);
    } catch (error) {
      console.error('Error reading EXIF data:', error);
    }
  }

  // Delete the original file uploaded to the "Uploads" bucket
  await sourceBucket.file(gcsFile.name).delete();
  console.log(`Deleted uploaded file: ${gcsFile.name}`);
};

//Entry Point Function 
async function extractExif() {
  let gpsObject = await readExifData('china1.jpeg');
  console.log(gpsObject);
  let gpsDecimal = getGPSCoordinates(gpsObject);
  console.log(gpsDecimal);
  console.log(gpsDecimal.lat);
  console.log(gpsDecimal.lon);
}

//Call the Entry Point (not needed in GCF)
extractExif();

// Helper Functions
async function readExifData(localFile) {
  let exifData;
  try {
    exifData = await getExif(localFile);
    return exifData.gps;
  } catch (err) {
    console.log(err);
    return null;
  }
}

function getGPSCoordinates(g) {
  const latString = `${g.GPSLatitude[0]}:${g.GPSLatitude[1]}:${g.GPSLatitude[2]}${g.GPSLatitudeRef}`;
  const lonString = `${g.GPSLongitude[0]}:${g.GPSLongitude[1]}:${g.GPSLongitude[2]}${g.GPSLongitudeRef}`;
  const degCoords = parseDMS(`${latString} ${lonString}`);
  return degCoords;
}

// Function to write to Firestore
async function writeToFirestore(dataObject) {
  const firestore = new Firestore({
    projectId: "sp24-41200-mwhitte-globaljags",
    // Add other Firestore configurations as needed
  });

      // Create a dummy object for demo purposes 
      let dataObject = {};

      // Add some key: value pairs 
      dataObject.thumbURL = "";
      dataObject.imageURL = "";
      dataObject.latitude = "";
      dataObject.logitude = "";
  
      console.log(`The dataObject: `);
      console.log(dataObject);

  // Write the object into Firestore
  const collectionRef = firestore.collection('photos');
  const documentRef = await collectionRef.add(dataObject);
  console.log(`Document created: ${documentRef.id}`);
}