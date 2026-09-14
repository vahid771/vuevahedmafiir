import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getDocuments,
  uploadDocument,
  downloadDocument,
  deleteDocument,
  type Document,
} from '../api/documents';
import { formatDate } from '../utils/format';

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
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploading, setUploading] = useState(false);

  async function load(tag?: string) {
    try {
      setLoading(true);
      setDocs(await getDocuments(token!, tag ?? undefined));
    } catch {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

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
      await uploadDocument(token!, uploadFile, uploadTitle, tags);
      setShowUpload(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadTags('');
      await load();
    } catch {
      setError('Failed to upload document');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this document?')) return;
    try {
      await deleteDocument(token!, id);
      await load(activeTag ?? undefined);
    } catch {
      setError('Failed to delete document');
    }
  }

  async function handleDownload(doc: Document) {
    try {
      await downloadDocument(token!, doc.id, doc.title);
    } catch {
      setError('Failed to download document');
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <button onClick={() => setShowUpload(s => !s)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Upload</button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold ml-4">×</button>
        </div>
      )}

      {showUpload && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Upload Document</h2>
          <div className="space-y-3">
            <input type="file" className="w-full text-sm" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
            <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="Title *" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} />
            <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="Tags (comma-separated, e.g. tax, 2024)" value={uploadTags} onChange={e => setUploadTags(e.target.value)} />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadTitle.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button onClick={() => setShowUpload(false)} className="px-4 py-2 rounded text-sm border border-gray-300 hover:bg-gray-50">Cancel</button>
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
            <button onClick={() => setActiveTag(null)} className="text-xs px-3 py-1 rounded-full border border-gray-300 text-gray-400 hover:bg-gray-50">Clear filter</button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No documents yet.</p>
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
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <button onClick={() => handleDownload(doc)} className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50">Download</button>
                  <button onClick={() => handleDelete(doc.id)} className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50">Del</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
