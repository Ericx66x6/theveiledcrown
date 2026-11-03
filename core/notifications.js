import { newId, timestamp } from './model.js';
export function notification(
  doc,
  {
    audience = 'gm',
    recipient_id = null,
    title,
    message = '',
    target = '',
    kind = 'submission',
    created_by = null
  }
) {
  const n = {
    id: newId(),
    audience,
    recipient_id,
    title: String(title).slice(0, 200),
    message: String(message).slice(0, 5000),
    target,
    kind,
    created_by,
    hidden_by: [],
    created_at: timestamp(),
    read_by: []
  };
  doc.notifications ??= [];
  doc.notifications.unshift(n);
  return n;
}
export function notifyCampaign(doc, actor, payload) {
  for (const a of doc.accounts.filter(
    (a) => a.active && (a.role === 'admin' || a._campaign_member)
  ))
    notification(doc, {
      ...payload,
      audience: 'account',
      recipient_id: a.id,
      created_by: actor.id
    });
}
