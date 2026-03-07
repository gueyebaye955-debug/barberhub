const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function isConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Upload a base64 data URI or remote URL to Cloudinary.
 * Returns the secure CDN URL string.
 */
async function uploadImage(source, folder = 'jotma') {
  const result = await cloudinary.uploader.upload(source, {
    folder,
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  });
  return result.secure_url;
}

/**
 * Delete an image from Cloudinary by its public_id.
 * Extracts the public_id from a full Cloudinary URL if needed.
 */
async function deleteImage(urlOrPublicId) {
  if (!urlOrPublicId) return;
  let publicId = urlOrPublicId;
  // Extract public_id from a full Cloudinary URL
  const match = urlOrPublicId.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
  if (match) publicId = match[1];
  await cloudinary.uploader.destroy(publicId);
}

module.exports = { uploadImage, deleteImage, isConfigured };
