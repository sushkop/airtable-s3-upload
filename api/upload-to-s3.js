const fetch = require('node-fetch');
const Airtable = require('airtable');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_BASE_ID);

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

module.exports = async (req, res) => {
  try {
    const { recordId, attachmentUrl, filename, mimetype } = req.body;

    const safeFilename = filename || 'file';
    const contentType =
      typeof mimetype === 'string' && mimetype.trim() !== ''
        ? mimetype
        : 'application/octet-stream';

    const response = await fetch(attachmentUrl);
    const buffer = await response.buffer();

    const key = `airtable-uploads/${uuidv4()}-${safeFilename}`;
await s3.send(
  new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  })
);

    const s3Url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    await base(process.env.AIRTABLE_TABLE_NAME).update(recordId, {
      "S3 URL": s3Url,
    });

    res.status(200).json({ success: true, s3Url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
