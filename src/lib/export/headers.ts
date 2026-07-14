const SAFE_FILENAME = /[^a-zA-Z0-9._-]/g;

export function privateNoStoreHeaders(): Headers {
  return new Headers({
    "Cache-Control": "private, no-store",
  });
}

export function exportHeaders(filename: string, contentType: string): Headers {
  const safeFilename = filename.replace(SAFE_FILENAME, "-").replace(/-+/g, "-") || "export";
  const headers = privateNoStoreHeaders();
  headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`);
  headers.set("Content-Type", `${contentType}; charset=utf-8`);
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}
