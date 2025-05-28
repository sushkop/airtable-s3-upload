const fetch = require('node-fetch');
const Airtable = require('airtable');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

module.exports = async (req, res) => {
  try {
    const { recordId, filename, mimetype } = req.body;
    const attachmentUrl = Array.isArray(req.body.attachmentUrl)
      ? req.body.attachmentUrl[0]
      : req.body.attachmentUrl;

    console.log('🔗 Downloading from:', attachmentUrl);

    const originalBuffer = await fetch(attachmentUrl).then(r => r.buffer());

    // 🧼 Clean the filename
    const rawFilename = Array.isArray(filename) ? filename[0] : filename || 'file';
    const safeFilename = rawFilename
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')               // replace spaces
      .replace(/[^a-z0-9_\-.]/g, '')      // remove unsafe chars
      .replace(/\.[^.]+$/, '')            // remove original extension
      .slice(0, 100);

    const finalFilename = `${safeFilename}.webp`;
    const contentType = 'image/webp';

    // 🖼 Resize + convert to WebP
    const transformedBuffer = await sharp(originalBuffer)
      .resize(400, 400, { fit: 'cover' }) // Center crop to 800x800
      .toFormat('webp')
      .toBuffer();

    const key = `airtable-uploads/${uuidv4()}-${finalFilename}`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: transformedBuffer,
      ContentType: contentType,
    }));

    const s3Url = `https://d2e4s9uqom2sw.cloudfront.net/${key}`;
    console.log('✅ Uploaded to:', s3Url);

    await base(process.env.AIRTABLE_TABLE_NAME).update(recordId, {
      "S3 URL": s3Url,
    });

    res.status(200).json({ success: true, s3Url });
  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).json({ error: err.message });
  }
};
