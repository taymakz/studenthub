import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { config } from "@/config"

/**
 * Supabase Storage via its S3-compatible endpoint. Used ONLY for one-time
 * export images (برنامه هفتگی / برنامه امتحانی): the client uploads through a
 * presigned PUT, the API hands Telegram a short-lived presigned GET and the
 * object is deleted right after the bot accepts it - nothing persists.
 */

let client: S3Client | null = null

function configured(): boolean {
  return Boolean(
    config.SUPABASE_S3_ENDPOINT &&
    config.SUPABASE_S3_ACCESS_KEY_ID &&
    config.SUPABASE_S3_SECRET_ACCESS_KEY
  )
}

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: config.SUPABASE_S3_REGION,
      endpoint: config.SUPABASE_S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.SUPABASE_S3_ACCESS_KEY_ID,
        secretAccessKey: config.SUPABASE_S3_SECRET_ACCESS_KEY,
      },
    })
  }
  return client
}

export const EXPORT_URL_TTL_SECONDS = 60 * 30

export async function presignExportPut(
  key: string
): Promise<{ uploadUrl: string; objectUrl: string }> {
  const cmd = new PutObjectCommand({
    Bucket: config.SUPABASE_S3_BUCKET,
    Key: key,
  })
  const uploadUrl = await getSignedUrl(s3(), cmd, { expiresIn: 300 })
  return { uploadUrl, objectUrl: key }
}

export async function deleteExportObject(key: string): Promise<void> {
  try {
    await s3().send(
      new DeleteObjectCommand({ Bucket: config.SUPABASE_S3_BUCKET, Key: key })
    )
  } catch {
    // Best-effort cleanup - the presigned GET expires on its own anyway.
  }
}

/**
 * Public HTTP URL for the export object — Telegram can fetch these directly
 * once the bucket has a public-read policy.
 */
export function publicExportUrl(key: string): string {
  const endpoint = config.SUPABASE_S3_ENDPOINT
  const refMatch = endpoint.match(/^https?:\/\/([^.]+)\.storage/)
  const ref = refMatch?.[1] ?? ""
  const bucket = config.SUPABASE_S3_BUCKET
  return `https://${ref}.supabase.co/storage/v1/object/public/${bucket}/${key}`
}

/** Download export object bytes from S3 for direct upload to Telegram. */
export async function getExportBytes(key: string): Promise<Buffer> {
  const cmd = new GetObjectCommand({
    Bucket: config.SUPABASE_S3_BUCKET,
    Key: key,
  })
  const res = await s3().send(cmd)
  const stream = res.Body
  if (!stream) throw new Error("Empty response from S3")
  const chunks: Uint8Array[] = []
  const reader = stream.transformToWebStream().getReader()
  let done = false
  while (!done) {
    const result = await reader.read()
    done = result.done
    if (result.value) chunks.push(result.value)
  }
  return Buffer.concat(chunks)
}

export { configured as isExportStorageConfigured }
