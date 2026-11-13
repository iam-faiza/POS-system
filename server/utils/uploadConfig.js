const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');
const multer = require('multer');
const sharp = require('sharp');

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_IMAGE_OUTPUT_BYTES = 5 * 1024 * 1024;
const IMAGE_FORMATS = {
  jpeg: { mimeType: 'image/jpeg', extension: '.jpg' },
  png: { mimeType: 'image/png', extension: '.png' },
  webp: { mimeType: 'image/webp', extension: '.webp' }
};
const ALLOWED_IMAGE_TYPES = Object.values(IMAGE_FORMATS).map(({ mimeType }) => mimeType);
const SERVER_ROOT = path.resolve(__dirname, '..');
const DEFAULT_UPLOAD_DIR = path.resolve(SERVER_ROOT, 'uploads/products');
const DEFAULT_PUBLIC_BASE = '/uploads';

class ProductImageError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ProductImageError';
    this.status = status;
  }
}

function getConfiguredUploadDir() {
  const configuredDir = process.env.UPLOAD_DIR;
  const uploadDir = configuredDir
    ? path.isAbsolute(configuredDir)
      ? configuredDir
      : path.resolve(SERVER_ROOT, configuredDir)
    : DEFAULT_UPLOAD_DIR;

  fs.mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
}

function getPublicUploadBase() {
  return (process.env.UPLOAD_URL_BASE || DEFAULT_PUBLIC_BASE).replace(/\/+$/, '');
}

function getAllowedProductImageTypes() {
  return [...ALLOWED_IMAGE_TYPES];
}

async function reencodeProductImage(inputBuffer, declaredMimeType) {
  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new ProductImageError('The uploaded file is empty or invalid');
  }
  if (inputBuffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new ProductImageError('Product images cannot exceed 2 MB', 413);
  }

  try {
    const options = { failOn: 'warning', limitInputPixels: MAX_IMAGE_PIXELS, sequentialRead: true };
    const metadata = await sharp(inputBuffer, options).metadata();
    const format = IMAGE_FORMATS[metadata.format];
    if (!format || !metadata.width || !metadata.height) {
      throw new ProductImageError('Only valid JPEG, PNG, and WebP raster images are allowed');
    }
    if (metadata.pages && metadata.pages > 1) {
      throw new ProductImageError('Animated and multi-page images are not supported');
    }
    if (declaredMimeType && declaredMimeType.toLowerCase() !== format.mimeType) {
      throw new ProductImageError('The file content does not match its declared image type');
    }

    let pipeline = sharp(inputBuffer, options).rotate();
    if (metadata.format === 'jpeg') pipeline = pipeline.jpeg({ quality: 88, mozjpeg: true });
    else if (metadata.format === 'png') pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
    else pipeline = pipeline.webp({ quality: 88 });

    const { data } = await pipeline.toBuffer({ resolveWithObject: true });
    if (data.length > MAX_IMAGE_OUTPUT_BYTES) {
      throw new ProductImageError('The processed image is too large');
    }

    return { buffer: data, ...format };
  } catch (error) {
    if (error instanceof ProductImageError) throw error;
    throw new ProductImageError('The uploaded file is not a valid supported image');
  }
}

function buildProductImagePath(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const cleaned = String(filename).trim().replace(/\\/g, '/').split('/').filter(Boolean).join('/');
  if (!cleaned) return null;
  const publicBase = getPublicUploadBase();
  return `${publicBase}/products/${cleaned}`;
}

function formatProductImageUrl(value) {
  if (!value) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function resolveProductImageValue({ file, body, removeImage, currentImage } = {}) {
  const shouldRemove = typeof removeImage === 'string'
    ? ['true', '1', 'yes', 'on'].includes(removeImage.trim().toLowerCase())
    : Boolean(removeImage);

  if (shouldRemove) {
    return null;
  }

  if (file && file.filename) {
    return buildProductImagePath(file.filename);
  }

  if ((body && typeof body.image === 'string' && body.image.trim()) ||
      (body && typeof body.imageUrl === 'string' && body.imageUrl.trim())) {
    throw new ProductImageError('Product images must be uploaded as JPEG, PNG, or WebP files');
  }

  return currentImage ? formatProductImageUrl(currentImage) : null;
}

function deleteStoredProductImage(imageValue) {
  if (!imageValue || typeof imageValue !== 'string') return;
  const normalized = imageValue.trim();
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('data:')) {
    return;
  }

  const publicPrefix = `${getPublicUploadBase()}/products/`;
  if (!normalized.startsWith(publicPrefix)) return;
  const fileName = normalized.slice(publicPrefix.length);
  if (!fileName || path.basename(fileName) !== fileName || fileName.includes('\\')) return;
  if (!fileName || fileName === '.' || fileName === '/') {
    return;
  }

  const diskPath = path.join(getConfiguredUploadDir(), fileName);
  try {
    fs.unlinkSync(diskPath);
  } catch (error) {
    // Ignore cleanup failures for missing or already removed files.
  }
}

const parseProductImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 1
  },
}).single('image');

function uploadProductImage(req, res, next) {
  parseProductImage(req, res, async (parseError) => {
    if (parseError) {
      const status = parseError.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({
        message: status === 413 ? 'Product images cannot exceed 2 MB' : 'Product image upload was rejected'
      });
    }
    if (!req.file) return next();

    let outputPath;
    try {
      const processed = await reencodeProductImage(req.file.buffer, req.file.mimetype);
      const filename = `${crypto.randomUUID()}${processed.extension}`;
      outputPath = path.join(getConfiguredUploadDir(), filename);
      await fs.promises.writeFile(outputPath, processed.buffer, { flag: 'wx' });
      req.file = {
        fieldname: req.file.fieldname,
        filename,
        path: outputPath,
        mimetype: processed.mimeType,
        size: processed.buffer.length
      };
      res.once('finish', () => {
        if (req.productImagePersisted || !req.file?.path) return;
        fs.promises.unlink(req.file.path).catch(() => {});
      });
      return next();
    } catch (error) {
      if (outputPath) {
        try { await fs.promises.unlink(outputPath); } catch {}
      }
      return res.status(error.status || 500).json({
        message: error.status ? error.message : 'Unable to safely process product image'
      });
    }
  });
}

function serveLegacyProductImage(uploadDir = getConfiguredUploadDir()) {
  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let filename;
    try {
      filename = decodeURIComponent(req.path.replace(/^\/+/, ''));
    } catch {
      return res.sendStatus(400);
    }
    if (!filename) return next();
    if (path.basename(filename) !== filename || filename.includes('\\') || filename.startsWith('.')) {
      return res.sendStatus(404);
    }

    try {
      const legacyPath = path.resolve(uploadDir, filename);
      if (!legacyPath.startsWith(`${path.resolve(uploadDir)}${path.sep}`)) return res.sendStatus(404);
      const realUploadDir = await fs.promises.realpath(uploadDir);
      const realImagePath = await fs.promises.realpath(legacyPath);
      if (!realImagePath.startsWith(`${realUploadDir}${path.sep}`)) return res.sendStatus(404);
      const stat = await fs.promises.stat(realImagePath);
      if (!stat.isFile() || stat.size > MAX_IMAGE_SIZE_BYTES) return res.sendStatus(404);
      const legacyBuffer = await fs.promises.readFile(realImagePath);
      const processed = await reencodeProductImage(legacyBuffer);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Content-Type', processed.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=300, immutable');
      return res.status(200).send(processed.buffer);
    } catch {
      return res.sendStatus(404);
    }
  };
}

module.exports = {
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_OUTPUT_BYTES,
  ALLOWED_IMAGE_TYPES,
  ProductImageError,
  getAllowedProductImageTypes,
  reencodeProductImage,
  buildProductImagePath,
  formatProductImageUrl,
  resolveProductImageValue,
  deleteStoredProductImage,
  uploadProductImage,
  serveLegacyProductImage,
  getConfiguredUploadDir,
  getPublicUploadBase
};
