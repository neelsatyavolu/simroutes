import { db } from "../db";

export interface NavigraphLink {
  alias: string;
  connectedAt: string;
}

export async function getNavigraphLink(userId: string): Promise<NavigraphLink | null> {
  const rows = (await db()`
    SELECT navigraph_alias, navigraph_connected_at FROM user_settings
    WHERE user_id = ${userId} AND navigraph_alias IS NOT NULL`) as { navigraph_alias: string; navigraph_connected_at: Date }[];
  const r = rows[0];
  return r ? { alias: r.navigraph_alias, connectedAt: new Date(r.navigraph_connected_at).toISOString() } : null;
}

export async function saveNavigraphLink(userId: string, subject: string, alias: string): Promise<void> {
  await db()`
    INSERT INTO user_settings (user_id, navigraph_subject, navigraph_alias, navigraph_connected_at, updated_at)
    VALUES (${userId}, ${subject}, ${alias}, now(), now())
    ON CONFLICT (user_id) DO UPDATE SET
      navigraph_subject = EXCLUDED.navigraph_subject,
      navigraph_alias = EXCLUDED.navigraph_alias,
      navigraph_connected_at = now(),
      updated_at = now()`;
}

export async function removeNavigraphLink(userId: string): Promise<void> {
  await db()`
    UPDATE user_settings SET navigraph_subject = NULL, navigraph_alias = NULL, navigraph_connected_at = NULL, updated_at = now()
    WHERE user_id = ${userId}`;
}
