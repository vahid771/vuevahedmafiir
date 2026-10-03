import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAttachments, addAttachment, removeAttachment, type AttachedDocument, type EntityType } from '../../api/attachments';
import { getDocuments, uploadDocument, type Document } from '../../api/documents';
import { getGoogleDriveStatus } from '../../api/google';

function fileTypeIcon(mimetype: string): string {
  if (mimetype === 'application/pdf') return '📄';
  if (mimetype.startsWith('image/')) return '🖼️';
  if (mimetype.startsWith('text/')) return '📝';
  return '📎';
}

interface Props {
  entityType: EntityType;
  entityId: number;
  token: string;
}

export default function AttachmentsSection({ entityType, entityId, token }: Props) {
  const { t } = useTranslation();
  const [attachedDocs, setAttachedDocs] = useState<AttachedDocument[]>([]);
  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [driveConnected, setDriveConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Detach state: track which doc IDs are being detached
  const [detaching, setDetaching] = useState<Set<number>>(new Set());

  // Attach existing
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [attaching, setAttaching] = useState(false);

  // Upload & attach
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      getAttachments(token, entityType, entityId),
      getDocuments(token),
      getGoogleDriveStatus(token),
    ])
      .then(([attached, docs, driveStatus]) => {
        if (cancelled) return;
        setAttachedDocs(attached);
        setAllDocs(docs);
        setDriveConnected(driveStatus.connected);
      })
      .catch(() => {
        if (!cancelled) setError(t('attachments.failedLoad'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token, entityType, entityId]);

  async function handleDetach(docId: number) {
    setDetaching(prev => new Set(prev).add(docId));
    try {
      await removeAttachment(token, entityType, entityId, docId);
      setAttachedDocs(prev => prev.filter(d => d.id !== docId));
    } catch {
      setError(t('attachments.failedDetach'));
    } finally {
      setDetaching(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  }

  async function handleAttach() {
    if (!selectedDoc) return;
    setAttaching(true);
    try {
      await addAttachment(token, entityType, entityId, selectedDoc.id);
      const attached: AttachedDocument = {
        id: selectedDoc.id,
        title: selectedDoc.title,
        filename: selectedDoc.filename,
        mimetype: selectedDoc.mimetype,
        drive_file_id: null,
        drive_view_link: null,
      };
      setAttachedDocs(prev => [...prev, attached]);
      setSelectedDoc(null);
      setSearchQuery('');
    } catch {
      setError(t('attachments.failedAttach'));
    } finally {
      setAttaching(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    setError('');
    try {
      const newDoc = await uploadDocument(token, uploadFile, uploadTitle.trim(), []);
      await addAttachment(token, entityType, entityId, newDoc.id);
      const attached: AttachedDocument = {
        id: newDoc.id,
        title: newDoc.title,
        filename: newDoc.filename,
        mimetype: newDoc.mimetype,
        drive_file_id: null,
        drive_view_link: null,
      };
      setAttachedDocs(prev => [...prev, attached]);
      setAllDocs(prev => [...prev, newDoc]);
      setUploadTitle('');
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      setError(t('attachments.failedUpload'));
    } finally {
      setUploading(false);
    }
  }

  const attachedIds = new Set(attachedDocs.map(d => d.id));
  const filteredDocs = allDocs.filter(
    d => !attachedIds.has(d.id) &&
      d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200 mb-2" />
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">{t('attachments.title')}</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm flex justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="font-bold ml-3">×</button>
        </div>
      )}

      {/* Attached documents list */}
      {attachedDocs.length > 0 ? (
        <div className="space-y-1.5">
          {attachedDocs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-2 text-sm">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base">{fileTypeIcon(doc.mimetype)}</span>
                <span className="font-medium text-gray-800 truncate">{doc.title}</span>
                {doc.drive_view_link && (
                  <a
                    href={doc.drive_view_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline whitespace-nowrap ml-1"
                  >
                    {t('attachments.openInDrive')}
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDetach(doc.id)}
                disabled={detaching.has(doc.id)}
                className="ml-3 text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300 disabled:opacity-50 transition-colors shrink-0"
              >
                {detaching.has(doc.id) ? '…' : t('attachments.detach')}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">{t('attachments.noAttachments')}</p>
      )}

      {/* Attach existing */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('attachments.attachExisting')}</label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={selectedDoc ? selectedDoc.title : searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSelectedDoc(null); }}
              placeholder={t('attachments.searchPlaceholder')}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {!selectedDoc && searchQuery.length > 0 && filteredDocs.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow text-sm max-h-40 overflow-y-auto">
                {filteredDocs.map(doc => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-blue-50"
                    onMouseDown={() => { setSelectedDoc(doc); setSearchQuery(''); }}
                  >
                    <span>{fileTypeIcon(doc.mimetype)}</span>
                    <span className="truncate">{doc.title}</span>
                  </li>
                ))}
              </ul>
            )}
            {!selectedDoc && searchQuery.length > 0 && filteredDocs.length === 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow text-sm px-3 py-2 text-gray-400">
                {t('attachments.noMatching')}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleAttach}
            disabled={!selectedDoc || attaching}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {attaching ? t('attachments.attaching') : t('attachments.attach')}
          </button>
        </div>
      </div>

      {/* Upload & attach */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('attachments.uploadAndAttach')}</label>
        {!driveConnected ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded text-sm flex items-center justify-between">
            <span>{t('attachments.driveNotConnected')}</span>
             <a href="/settings" className="ml-3 font-medium underline hover:text-amber-900 whitespace-nowrap">{t('attachments.goToSettings')}</a>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="space-y-2">
            <input
              type="text"
              value={uploadTitle}
              onChange={e => setUploadTitle(e.target.value)}
              placeholder="Document title"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              ref={fileInputRef}
              type="file"
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
            <button
              type="submit"
              disabled={uploading || !uploadFile || !uploadTitle.trim()}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? t('attachments.uploading') : t('attachments.uploadAndAttach')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
