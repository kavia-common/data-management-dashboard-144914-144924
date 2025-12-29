import React, { useEffect, useState } from 'react';
import { fetchUserSessions, SessionRecord } from '../../api/usersSessions';

type Props = {
  userId: string;
  organizationId?: string | null;
};

const Empty: React.FC = () => (
  <div className="p-4 text-gray-500">No sessions found for this user.</div>
);

// PUBLIC_INTERFACE
export const SessionDetailsTab: React.FC<Props> = ({ userId, organizationId }) => {
  /** Session Details tab which loads sessions from the backend for a selected user. */
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SessionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const { items: rows } = await fetchUserSessions(userId, organizationId ?? undefined);
        if (!cancelled) setItems(rows);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load sessions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, organizationId]);

  if (loading) return <div className="p-4">Loading sessions...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;
  if (!items?.length) return <Empty />;

  return (
    <div className="p-4 space-y-3">
      {items.map((s: any, idx) => {
        const id = s._id || `${idx}`;
        const sessionId = s.session_id || '—';
        const projectId = s.project_id || '—';
        const status = s.status || '—';
        const ts =
          s.timestamp || s.created_at || s.last_updated || s.session_start || s.session_end || null;
        const when = ts ? new Date(ts).toLocaleString() : '—';
        const model = s.llm_model || s.model || '—';
        return (
          <div
            key={id}
            className="rounded-md border border-gray-200 bg-white p-3 shadow-sm hover:shadow transition"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-gray-800">Session: {sessionId}</div>
              <div className="text-sm text-gray-500">{when}</div>
            </div>
            <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-700">
              <div>
                <span className="text-gray-500">Project:</span> {projectId}
              </div>
              <div>
                <span className="text-gray-500">Status:</span> {status}
              </div>
              <div>
                <span className="text-gray-500">Model:</span> {model}
              </div>
            </div>
            {s.session_name || s.description ? (
              <div className="mt-2 text-sm text-gray-600">
                {s.session_name ? <div>Title: {s.session_name}</div> : null}
                {s.description ? <div>Description: {s.description}</div> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default SessionDetailsTab;
