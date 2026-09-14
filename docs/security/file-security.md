# Stockora Enterprise — File Upload & Storage Security

## 1. Threat Vectors
- Arbitrary code execution via uploaded server scripts (`.php`, `.jsp`, `.exe`, `.sh`).
- Path traversal attacks exploiting unvalidated filenames (`../../`).
- MIME-type spoofing (executables disguised as image files).
- Denial of Service via zip bombs or oversized file payloads.

---

## 2. Implemented Defense Controls
1. **Extension Whitelist**: Only approved formats (`.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`, `.csv`, `.xlsx`) are accepted.
2. **MIME Verification**: Magic byte inspection and MIME-type header checks.
3. **Randomized File Naming**: Uploaded files are stored with cryptographically generated UUIDs rather than original user-supplied filenames.
4. **Path Traversal Prevention**: Storage paths are normalized using `path.resolve()` and restricted to isolated upload roots.
5. **Payload Size Bounds**: Uploads capped at strict limits (e.g. 5MB for images, 25MB for bulk import files).
6. **Access Scoping**: Tenant-scoped authorization required to access business documents and receipts.
