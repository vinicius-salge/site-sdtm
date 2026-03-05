# Storage

> **Purpose**: S3-compatible object storage with RLS policies and image transformations
> **Confidence**: 0.95
> **MCP Validated**: 2026-02-05

## Overview

Supabase Storage provides S3-compatible object storage with built-in access control via RLS policies, image transformations, and CDN delivery. Supports public and private buckets with signed URLs.

## The Pattern

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, anonKey)

// Upload file
const { data, error } = await supabase.storage
  .from('invoices')
  .upload(`user-${userId}/invoice-001.pdf`, file, {
    cacheControl: '3600',
    upsert: false
  })

// Get public URL (for public buckets)
const { data: { publicUrl } } = supabase.storage
  .from('invoices')
  .getPublicUrl('path/to/file.pdf')

// Download file
const { data, error } = await supabase.storage
  .from('invoices')
  .download('path/to/file.pdf')

// Create signed URL (for private buckets)
const { data, error } = await supabase.storage
  .from('invoices')
  .createSignedUrl('path/to/file.pdf', 60) // 60 seconds
```

## Quick Reference

| Operation | Method | Returns |
|-----------|--------|---------|
| Upload | `.upload(path, file)` | Path data |
| Download | `.download(path)` | Blob |
| Public URL | `.getPublicUrl(path)` | URL string |
| Signed URL | `.createSignedUrl(path, expiry)` | Signed URL |
| List | `.list(path)` | File array |
| Delete | `.remove([paths])` | Delete result |
| Move | `.move(from, to)` | New path |

## RLS Policies

```sql
-- Allow users to upload to their own folder
CREATE POLICY "Users can upload own files"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'invoices' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow users to read their own files
CREATE POLICY "Users can read own files"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'invoices' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );
```

## Common Mistakes

### Wrong

```typescript
// Using public URL for private bucket
const { data } = supabase.storage.from('private').getPublicUrl('secret.pdf')
// URL will 403 - bucket is private
```

### Correct

```typescript
// Use signed URL for private buckets
const { data, error } = await supabase.storage
  .from('private')
  .createSignedUrl('secret.pdf', 300) // 5 min expiry

if (data) {
  window.open(data.signedUrl)
}
```

## Image Transformations

```typescript
// Resize image on-the-fly
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl('user-123.jpg', {
    transform: {
      width: 100,
      height: 100,
      resize: 'cover', // 'cover' | 'contain' | 'fill'
      format: 'webp'
    }
  })
```

## Related

- [database.md](database.md)
- [auth.md](auth.md)
- [rls-policies.md](../patterns/rls-policies.md)
