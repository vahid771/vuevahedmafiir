import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  getAdminImages, reviewImage, getAdminUsers, setUserAdmin,
  type AdminImageRecord, type AdminUser,
} from '../api/admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: AdminImageRecord['status'] }) {
  const colors: Record<string, string> = {
    pending:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    approved: 'bg-green-100  text-green-800  dark:bg-green-900/40  dark:text-green-300',
    rejected: 'bg-red-100    text-red-800    dark:bg-red-900/40    dark:text-red-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors[status] ?? colors.pending}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Image card
// ---------------------------------------------------------------------------
function ImageCard({
  img,
  onReview,
}: {
  img: AdminImageRecord;
  onReview: (id: number, status: 'approved' | 'rejected' | 'pending', note?: string) => Promise<void>;
}) {
  const [note, setNote] = useState(img.review_note ?? '');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handle(status: 'approved' | 'rejected' | 'pending') {
    setSaving(true);
    try {
      await onReview(img.id, status, note || undefined);
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = img.drive_view_link ?? null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
      {/* Image preview */}
      <div
        className="relative bg-gray-100 dark:bg-gray-700 cursor-pointer"
        style={{ paddingTop: '60%' }}
        onClick={() => previewUrl && window.open(previewUrl, '_blank')}
      >
        {previewUrl ? (
          <img
            src={previewUrl.replace('/view', '/preview') /* Google Drive preview embed */}
            alt={img.title}
            className="absolute inset-0 w-full h-full object-cover"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3h18M3 21h18" />
            </svg>
          </div>
        )}
        {/* Status overlay */}
        <div className="absolute top-2 right-2">
          <StatusBadge status={img.status} />
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate" title={img.title}>{img.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{img.user_email}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400 dark:text-gray-500">
          <span>{img.mimetype}</span>
          <span>·</span>
          <span>{formatBytes(img.size)}</span>
          <span>·</span>
          <span>{new Date(img.uploaded_at).toLocaleDateString()}</span>
        </div>

        {/* Collapsible detail */}
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-blue-500 hover:underline text-left"
        >
          {expanded ? 'Hide details' : 'Show details'}
        </button>
        {expanded && (
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            <p><span className="font-medium">File:</span> {img.filename}</p>
            {img.reviewed_at && <p><span className="font-medium">Reviewed:</span> {new Date(img.reviewed_at).toLocaleString()}</p>}
            {img.review_note && <p><span className="font-medium">Note:</span> {img.review_note}</p>}
          </div>
        )}

        {/* Note input */}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Review note (optional)…"
          rows={2}
          className="text-xs w-full border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
        />

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            disabled={saving}
            onClick={() => handle('approved')}
            className="flex-1 text-xs px-2 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50 transition-colors"
          >
            ✓ Approve
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handle('rejected')}
            className="flex-1 text-xs px-2 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 transition-colors"
          >
            ✕ Reject
          </button>
          {img.status !== 'pending' && (
            <button
              type="button"
              disabled={saving}
              onClick={() => handle('pending')}
              className="flex-1 text-xs px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              ↺ Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------
function UsersTab({ token }: { token: string }) {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminUsers(token)
      .then(setUsers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function toggle(userId: number, makeAdmin: boolean) {
    setSaving(userId);
    try {
      await setUserAdmin(token, userId, makeAdmin);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: makeAdmin ? 1 : 0 } : u));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="text-sm text-gray-500 p-4">Loading users…</div>;
  if (error) return <div className="text-sm text-red-500 p-4">{error}</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Joined</th>
            <th className="py-2 font-medium">Admin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {users.map(u => (
            <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className="py-2 pr-4 text-gray-800 dark:text-gray-200 font-medium">{u.email}</td>
              <td className="py-2 pr-4 text-gray-500 dark:text-gray-400 text-xs">
                {new Date(u.created_at).toLocaleDateString()}
              </td>
              <td className="py-2">
                {u.id === me?.id ? (
                  <span className="text-xs text-gray-400 italic">you</span>
                ) : (
                  <button
                    type="button"
                    disabled={saving === u.id}
                    onClick={() => toggle(u.id, !u.is_admin)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                      u.is_admin ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${u.is_admin ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main admin page
// ---------------------------------------------------------------------------
type Tab = 'images' | 'users';
type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [tab, setTab] = useState<Tab>('images');
  const [images, setImages] = useState<AdminImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');

  const loadImages = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError('');
    getAdminImages(token)
      .then(setImages)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { loadImages(); }, [loadImages]);

  async function handleReview(id: number, status: 'approved' | 'rejected' | 'pending', note?: string) {
    if (!token) return;
    const updated = await reviewImage(token, id, status, note);
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...updated } as AdminImageRecord : img));
  }

  const filtered = images.filter(img => {
    if (filter !== 'all' && img.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return img.title.toLowerCase().includes(q) || img.user_email.toLowerCase().includes(q) || img.filename.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: images.length,
    pending:  images.filter(i => i.status === 'pending').length,
    approved: images.filter(i => i.status === 'approved').length,
    rejected: images.filter(i => i.status === 'rejected').length,
  };

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
    }`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {t('admin.title', 'Admin Dashboard')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {t('admin.subtitle', 'Review user-uploaded images and manage admin access.')}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 flex gap-1">
        <button type="button" className={tabClass(tab === 'images')} onClick={() => setTab('images')}>
          🖼 {t('admin.tabImages', 'Images')}
          {counts.pending > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-500 text-white text-[10px] font-bold">
              {counts.pending}
            </span>
          )}
        </button>
        <button type="button" className={tabClass(tab === 'users')} onClick={() => setTab('users')}>
          👥 {t('admin.tabUsers', 'Users')}
        </button>
      </div>

      {/* Images tab */}
      {tab === 'images' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
              {(['all', 'pending', 'approved', 'rejected'] as FilterStatus[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    filter === s
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {s === 'all' ? `All (${counts.all})` : `${s} (${counts[s]})`}
                </button>
              ))}
            </div>
            <input
              type="search"
              placeholder="Search by title, user or filename…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-0 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={loadImages}
              disabled={loading}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              ↺ Refresh
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm flex justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="font-bold">×</button>
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" style={{ height: 320 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
              <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3h18M3 21h18" />
              </svg>
              <p className="text-sm">{t('admin.noImages', 'No images found.')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(img => (
                <ImageCard key={img.id} img={img} onReview={handleReview} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && token && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <UsersTab token={token} />
        </div>
      )}
    </div>
  );
}
