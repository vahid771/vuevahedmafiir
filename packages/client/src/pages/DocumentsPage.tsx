import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  getDocuments,
  uploadDocument,
  downloadDocument,
  deleteDocument,
  syncDriveDocuments,
  type Document,
} from '../api/documents';
import { getGoogleDriveStatus } from '../api/google';
import { formatDate } from '../utils/format';
import { useSyncQueue } from '../context/SyncQueueContext';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileTypeIcon(mimetype: string): string {
  if (mimetype === 'application/pdf') return '📄';
  if (mimetype.startsWith('image/')) return '🖼️';
  if (mimetype.startsWith('text/')) return '📝';
  return '📎';
}

function parseTags(tagsStr: string): string[] {
  try { return JSON.parse(tagsStr); } catch { return []; }
}

export default function DocumentsPage() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const { addJob } = useSyncQueue();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveStatusLoading, setDriveStatusLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  async function load(tag?: string) {
    try {
      setLoading(true);
      setDocs(await getDocuments(token!, tag ?? undefined));
    } catch {
      setError(t('documents.failedLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!token) return;
    getGoogleDriveStatus(token)
      .then(s => setDriveConnected(s.connected))
      .catch(() => { /* non-fatal */ })
      .finally(() => setDriveStatusLoading(false));
  }, [token]);

  async function handleDriveSync() {
    if (!token) return;
    setSyncing(true);
    setSyncSuccess(false);
    try {
      await addJob({ key: 'sync.syncDrive' }, async () => {
        const synced = await syncDriveDocuments(token);
        setDocs(synced);
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2500);
      });
    } catch {
      setError(t('documents.failedLoad'));
    } finally {
      setSyncing(false);
    }
  }

  const allTags = Array.from(new Set(docs.flatMap(d => parseTags(d.tags))));
  const displayed = activeTag ? docs.filter(d => parseTags(d.tags).includes(activeTag)) : docs;

  function handleTagClick(tag: string) {
    const next = activeTag === tag ? null : tag;
    setActiveTag(next);
  }

  async function handleUpload() {
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      const tags = uploadTags.split(',').map(t => t.trim()).filter(Boolean);
      const reset = () => { setShowUpload(false); setUploadFile(null); setUploadTitle(''); setUploadTags(''); };
      await addJob(
        { key: 'sync.uploadItem', vars: { name: uploadTitle } },
        async () => { await uploadDocument(token!, uploadFile!, uploadTitle, tags); reset(); await load(); }
      );
    } catch {
      setError('Failed to upload document');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('documents.deleteConfirm'))) return;
    const doc = docs.find(d => d.id === id);
    try {
      await addJob(
        { key: 'sync.deleteItemDrive', vars: { name: doc?.title ?? 'document' } },
        async () => { await deleteDocument(token!, id); await load(activeTag ?? undefined); }
      );
    } catch {
      setError('Failed to delete document');
    }
  }

  async function handleDownload(doc: Document) {
    try {
      await downloadDocument(token!, doc.id, doc.title);
    } catch {
      setError(t('documents.failedDownload'));
    }
  }

  if (driveStatusLoading) return null;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('documents.title')}</h1>
        <div className="flex items-center gap-2">
          {driveConnected && (
            <button
              type="button"
              onClick={handleDriveSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title={t('documents.syncFromDrive')}
            >
              {syncing ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                </svg>
              ) : syncSuccess ? (
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {syncing ? t('documents.syncing') : syncSuccess ? t('documents.synced') : t('documents.syncFromDrive')}
            </button>
          )}
          <button
            onClick={() => setShowUpload(s => !s)}
            disabled={!driveConnected}
            title={!driveConnected ? t('documents.connectDriveToUpload') : undefined}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('documents.upload')}
          </button>
        </div>
      </div>

      {!driveConnected && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-center justify-between text-sm">
          <span>{t('documents.driveNotConnected')}</span>
          <a href="/settings" className="ml-4 font-medium underline hover:text-amber-900 whitespace-nowrap">{t('documents.goToSettings')}</a>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold ml-4">×</button>
        </div>
      )}

      {showUpload && driveConnected && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-3">{t('documents.uploadDocument')}</h2>
          <div className="space-y-3">
            <input type="file" className="w-full text-sm" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
            <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder={t('documents.uploadTitle')} value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} />
            <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder={t('documents.uploadTags')} value={uploadTags} onChange={e => setUploadTags(e.target.value)} />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadTitle.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {uploading ? t('documents.uploading') : t('documents.upload')}
            </button>
            <button onClick={() => setShowUpload(false)} className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`text-xs px-3 py-1 rounded-full border ${activeTag === tag ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
            >
              {tag}
            </button>
          ))}
          {activeTag && (
            <button onClick={() => setActiveTag(null)} className="text-xs px-3 py-1 rounded-full border border-gray-300 text-gray-400 hover:bg-gray-50">{t('documents.clearFilter')}</button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">{t('common.loading')}</p>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">{t('documents.noDocs')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(doc => {
            const tags = parseTags(doc.tags);
            const uploadedDate = formatDate(doc.uploaded_at);
            return (
              <div key={doc.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl">{fileTypeIcon(doc.mimetype)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                    <p className="text-xs text-gray-400">{formatSize(doc.size)} · {uploadedDate}</p>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tags.map(tag => (
                          <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-3 shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={!driveConnected}
                    title={!driveConnected ? t('documents.connectDriveToDownload') : t('documents.download')}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={!driveConnected}
                    title={!driveConnected ? t('documents.connectDriveToDelete') : t('common.delete')}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
