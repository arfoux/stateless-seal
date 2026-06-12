# Temporary Download Grant

Temporary download grants should be bound to a resource id and checked against
the current request.

```ts
const DownloadGrantToken = sealer.defineToken<{
  userId: string;
  fileId: string;
}>({
  purpose: "download-grant",
  ttl: "5m",
  audience: "web"
});
```

Create a grant:

```ts
const token = await DownloadGrantToken.seal({
  userId: "user_123",
  fileId: "file_abc"
});
```

Verify it for the requested resource:

```ts
const result = await DownloadGrantToken.unseal(token);

if (!result.ok) {
  return new Response("Invalid grant", { status: 403 });
}

if (result.payload.fileId !== requestedFileId) {
  return new Response("Invalid grant", { status: 403 });
}

if (!(await canDownload(result.payload.userId, requestedFileId))) {
  return new Response("Invalid grant", { status: 403 });
}
```

Do not rely on `purpose` alone for resource authorization. Purpose says what the
token is for; the encrypted payload says which resource it applies to.
