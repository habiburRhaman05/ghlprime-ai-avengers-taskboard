import 'server-only';
import { ArrowUpRight, KeyRound } from 'lucide-react';
import type { Actor } from '@/lib/auth';
import { query } from '@/lib/db';
import { safeLink } from '@/lib/validation';
import { addProjectAccessItems, removeProjectAccessItem } from './vault-actions';
import { AddAccessItems, RemoveAccessItem, RevealPassword } from './vault-form';

type AccessItem = {
  id: string;
  label: string;
  url: string | null;
  account_email: string | null;
  note: string | null;
  has_password: boolean;
};

export async function projectAccessItems(projectId: string, user: Actor) {
  const { rows: items } = await query<AccessItem>(
    `SELECT a.id,a.label,a.url,a.account_email,a.note,(a.encrypted_password IS NOT NULL) AS has_password
     FROM portal.project_access_items a
     WHERE a.project_id=$1 AND ($3 <> 'client_admin' OR EXISTS (
       SELECT 1 FROM portal.memberships WHERE project_id=a.project_id AND user_id=$2))
     ORDER BY a.created_at,a.id`,
    [projectId, user.id, user.role],
  );
  return items;
}

export function ProjectAccessVault({ projectId, items, canEdit }: {
  projectId: string;
  items: AccessItem[];
  canEdit: boolean;
}) {
  const addItems = addProjectAccessItems.bind(null, projectId);
  const removeItem = removeProjectAccessItem.bind(null, projectId);

  return <section className="card panel stack vault" id="access-vault" aria-labelledby="vault-heading">
    <header className="form-section-title">
      <span className="form-section-icon lilac"><KeyRound size={19} aria-hidden="true" /></span>
      <h2 id="vault-heading">Access vault</h2>
    </header>
    {items.length ? <ul className="vault-items">
      {items.map(item => {
        const url = safeLink.safeParse(item.url ?? '');
        return <li className="vault-entry" key={item.id}>
          <div className="vault-entry-heading">
            <h3>{item.label}</h3>
            {canEdit && <RemoveAccessItem itemId={item.id} label={item.label} action={removeItem} />}
          </div>
          {item.account_email && <small>{item.account_email}</small>}
          {item.note && <p className="preserve muted">{item.note}</p>}
          {((url.success && url.data) || item.has_password) && <div className="vault-entry-actions">
            {url.success && url.data && <a className="resource-link" href={url.data} target="_blank" rel="noreferrer">
              Open link <ArrowUpRight size={16} aria-hidden="true" />
            </a>}
            {item.has_password && <RevealPassword id={item.id} />}
          </div>}
        </li>;
      })}
    </ul> : <p className="vault-empty muted">No access items for this project yet.</p>}
    {canEdit && <AddAccessItems projectId={projectId} action={addItems} />}
  </section>;
}
