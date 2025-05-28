import fetch from 'node-fetch';
import Airtable from 'airtable';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_BASE_ID);

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  try {
const { recordId, attachmentUrl, filename, mimetype } = req.body;

const safeFilename = filename || 'file';
const contentType = typeof mimetype === 'string' && mimetype.trim() !== '' ? mimetype : 'application/octet-stream';

    const contentType = mimetype || 'application/octet-stream'; 
    const response = await fetch(attachmentUrl);
    const buffer = await response.buffer();

    const key = `airtable-uploads/${uuidv4()}-${filename}`;
await s3.send(new PutObjectCommand({
  Bucket: process.env.S3_BUCKET,
  Key: `airtable-uploads/${uuidv4()}-${safeFilename}`,
  Body: buffer,
  ContentType: contentType,
  ACL: 'public-read',
}));


    const s3Url = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;

    await base(process.env.AIRTABLE_TABLE_NAME).update(recordId, {
      "S3 URL": s3Url,
    });

    res.status(200).json({ success: true, s3Url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
