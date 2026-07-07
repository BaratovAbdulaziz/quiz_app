import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const R2_ENDPOINT = process.env.R2_ENDPOINT
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY
const R2_SECRET_KEY = process.env.R2_SECRET_KEY
const R2_BUCKET = process.env.R2_BUCKET || "quiz-app-files"

const client = R2_ENDPOINT && R2_ACCESS_KEY && R2_SECRET_KEY
  ? new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
      forcePathStyle: true,
    })
  : null

export async function uploadFile(key: string, body: Buffer | Uint8Array, contentType: string) {
  if (!client) return key
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
  return key
}

export async function getSignedFileUrl(key: string, expiresIn = 3600): Promise<string> {
  if (!client) return ""
  return getSignedUrl(client, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn })
}

export async function deleteFile(key: string) {
  if (!client) return
  await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
}
