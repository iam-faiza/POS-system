const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const sharp = require('sharp');
const { test } = require('node:test');
const { checkPermission } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');
const {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  buildProductImagePath,
  formatProductImageUrl,
  getConfiguredUploadDir,
  resolveProductImageValue,
  serveLegacyProductImage,
  uploadProductImage
} = require('../utils/uploadConfig');

async function withHttpServer(app, callback) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function createRaster(format) {
  const image = sharp({
    create: { width: 3, height: 2, channels: 3, background: { r: 32, g: 120, b: 210 } }
  });
  if (format === 'jpeg') return image.jpeg().toBuffer();
  if (format === 'webp') return image.webp().toBuffer();
  return image.png().toBuffer();
}

function makeForm(buffer, filename, mimeType) {
  const form = new FormData();
  form.append('image', new Blob([buffer], { type: mimeType }), filename);
  return form;
}

test('only decoded raster content is stored under canonical product-image URLs', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pos-product-images-'));
  const originalUploadDir = process.env.UPLOAD_DIR;
  process.env.UPLOAD_DIR = tempDir;
  const app = express();
  let canManageProducts = true;

  app.post('/api/products/image-test', (req, res, next) => {
    req.user = { permissions: canManageProducts ? [PERMISSIONS.PRODUCTS_MANAGE] : [] };
    return checkPermission(PERMISSIONS.PRODUCTS_MANAGE)(req, res, next);
  }, uploadProductImage, (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Image is required' });
    req.productImagePersisted = true;
    return res.status(201).json({ image: buildProductImagePath(req.file.filename) });
  });
  app.post('/api/products/image-fail', (req, res, next) => {
    req.user = { permissions: [PERMISSIONS.PRODUCTS_MANAGE] };
    return checkPermission(PERMISSIONS.PRODUCTS_MANAGE)(req, res, next);
  }, uploadProductImage, (_req, res) => res.status(500).json({ message: 'Simulated product write failure' }));
  app.use('/uploads/products', serveLegacyProductImage(tempDir));

  try {
    assert.deepEqual(ALLOWED_IMAGE_TYPES, ['image/jpeg', 'image/png', 'image/webp']);
    const png = await createRaster('png');
    const jpeg = await createRaster('jpeg');
    const webp = await createRaster('webp');

    await withHttpServer(app, async (baseUrl) => {
      let response = await fetch(`${baseUrl}/api/products/image-test`, {
        method: 'POST',
        body: makeForm(png, 'actually-a-png.html', 'image/png')
      });
      assert.equal(response.status, 201);
      const pngResult = await response.json();
      assert.match(pngResult.image, /^\/uploads\/products\/[0-9a-f-]{36}\.png$/i);

      response = await fetch(`${baseUrl}${pngResult.image}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.match(response.headers.get('content-security-policy'), /sandbox/);
      assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format, 'png');

      response = await fetch(`${baseUrl}/api/products/image-test`, {
        method: 'POST',
        body: makeForm(jpeg, 'incorrect-extension.png', 'image/jpeg')
      });
      assert.equal(response.status, 201);
      const jpegResult = await response.json();
      assert.match(jpegResult.image, /\.jpg$/);
      response = await fetch(`${baseUrl}${jpegResult.image}`);
      assert.equal(response.headers.get('content-type'), 'image/jpeg');
      assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format, 'jpeg');

      response = await fetch(`${baseUrl}/api/products/image-test`, {
        method: 'POST',
        body: makeForm(webp, 'product.jpg', 'image/webp')
      });
      assert.equal(response.status, 201);
      assert.match((await response.json()).image, /\.webp$/);

      response = await fetch(`${baseUrl}/api/products/image-test`, {
        method: 'POST',
        body: makeForm(png, 'spoofed.jpg', 'image/jpeg')
      });
      assert.equal(response.status, 400);

      response = await fetch(`${baseUrl}/api/products/image-test`, {
        method: 'POST',
        body: makeForm(Buffer.from('<html><script>alert(1)</script></html>'), 'x.png', 'image/png')
      });
      assert.equal(response.status, 400);

      response = await fetch(`${baseUrl}/api/products/image-test`, {
        method: 'POST',
        body: makeForm(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg', 'image/svg+xml')
      });
      assert.equal(response.status, 400);

      response = await fetch(`${baseUrl}/api/products/image-test`, {
        method: 'POST',
        body: makeForm(Buffer.from('not an image'), 'corrupt.png', 'image/png')
      });
      assert.equal(response.status, 400);

      response = await fetch(`${baseUrl}/api/products/image-test`, {
        method: 'POST',
        body: makeForm(Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1), 'large.png', 'image/png')
      });
      assert.equal(response.status, 413);

      const beforeFailedWrite = await fs.readdir(tempDir);
      response = await fetch(`${baseUrl}/api/products/image-fail`, {
        method: 'POST',
        body: makeForm(png, 'write-fails.png', 'image/png')
      });
      assert.equal(response.status, 500);
      await new Promise((resolve) => setTimeout(resolve, 25));
      assert.deepEqual((await fs.readdir(tempDir)).sort(), beforeFailedWrite.sort());

      canManageProducts = false;
      response = await fetch(`${baseUrl}/api/products/image-test`, {
        method: 'POST',
        body: makeForm(png, 'unauthorized.png', 'image/png')
      });
      assert.equal(response.status, 403);
      canManageProducts = true;

      const legacyName = 'existing-legacy-image.unknown';
      await fs.writeFile(path.join(tempDir, legacyName), png);
      response = await fetch(`${baseUrl}/uploads/products/${legacyName}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(await fs.readFile(path.join(tempDir, legacyName)).then((data) => data.equals(png)), true);

      response = await fetch(`${baseUrl}/uploads/products/not-found.png`);
      assert.equal(response.status, 404);
    });

    assert.equal(getConfiguredUploadDir(), tempDir);
    assert.equal(formatProductImageUrl('/uploads/products/old.png'), '/uploads/products/old.png');
    assert.equal(resolveProductImageValue({ currentImage: '/uploads/products/old.png' }), '/uploads/products/old.png');
    assert.equal(resolveProductImageValue({ removeImage: 'true', currentImage: '/uploads/products/old.png' }), null);
    assert.throws(() => resolveProductImageValue({ body: { image: 'data:text/html,<script>bad</script>' } }), /must be uploaded/);
  } finally {
    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});