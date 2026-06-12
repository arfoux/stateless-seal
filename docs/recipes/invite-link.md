# Invite Link

Invite links should carry the target tenant, invite id, and invited email.

```ts
const InviteToken = sealer.defineToken<{
  tenantId: string;
  inviteId: string;
  email: string;
}>({
  purpose: "invite-link",
  ttl: "7d",
  audience: "web",
  schema: {
    parse(input: unknown): {
      tenantId: string;
      inviteId: string;
      email: string;
    } {
      if (!input || typeof input !== "object") {
        throw new Error("Invalid payload.");
      }

      const value = input as Record<string, unknown>;

      if (
        typeof value.tenantId !== "string" ||
        typeof value.inviteId !== "string" ||
        typeof value.email !== "string"
      ) {
        throw new Error("Invalid payload.");
      }

      return {
        tenantId: value.tenantId,
        inviteId: value.inviteId,
        email: value.email
      };
    }
  }
});
```

After unsealing, compare the token payload to your current invite record:

```ts
const result = await InviteToken.unseal(token);

if (!result.ok) {
  return null;
}

const invite = await findInvite(result.payload.inviteId);

if (
  !invite ||
  invite.tenantId !== result.payload.tenantId ||
  invite.email !== result.payload.email
) {
  return null;
}
```

Use `oneTime: true` if accepting the invite should consume the link itself.
