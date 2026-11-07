import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, FileText, Image as ImageIcon, Trash2, Download,
  Loader2, AlertCircle, X,
} from 'lucide-react';
import {
  uploadPlayerFile, fetchPlayerFiles, deletePlayerFile,
  formatFileSize, type UploadedFile, UploadError,
} from '@/lib/uploads';
import { ConfirmDialog } from '@/components/ui';

interface DocumentUploadProps {
  playerId: string;
  category: 'photo' | 'document';
  label?: string;
  compact?: boolean;
}

export function DocumentUpload({ playerId, category, label, compact }: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UploadedFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const fetched = await fetchPlayerFiles(playerId);
    setFiles(fetched.filter((f) => f.fileCategory === category));
    setLoading(false);
  }, [playerId, category]);

  useEffect(() => { load(); }, [load]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError('');
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        await uploadPlayerFile(playerId, file, category);
      }
      await load();
    } catch (err) {
      const msg = err instanceof UploadError ? err.message : 'Upload error';
      setError(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePlayerFile(deleteTarget);
      setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof UploadError ? err.message : 'Delete error';
      setError(msg);
      setDeleteTarget(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const accept = category === 'photo' ? 'image/jpeg,image/png,image/webp' : 'application/pdf,image/png';
  const isPhoto = category === 'photo';

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center gap-2">
          {isPhoto ? <ImageIcon className="h-4 w-4 text-emerald-500" /> : <FileText className="h-4 w-4 text-blue-500" />}
          <h4 className="text-sm font-black text-slate-900 dark:text-white">{label}</h4>
          <span className="text-[10px] text-slate-400 font-semibold">
            {files.length} files
          </span>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition ${
          dragOver
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
            <p className="text-xs font-bold text-slate-500">Uploading & compressing...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isPhoto ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
              <Upload className="h-4 w-4" />
            </div>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Click or drag files here
            </p>
            <p className="text-[10px] text-slate-400">
              {isPhoto ? 'JPG, PNG, WebP — auto-compressed' : 'PDF, PNG — up to 5 MB'}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 text-xs font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="shrink-0 mr-auto"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <p className="text-center text-[11px] text-slate-400 py-2">No files uploaded yet</p>
      ) : (
        <div className={isPhoto && !compact ? 'grid grid-cols-3 gap-2' : 'space-y-2'}>
          {files.map((f) => (
            <FileCard key={f.id} file={f} isPhoto={isPhoto} onDelete={() => setDeleteTarget(f)} compact={compact} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete File"
        message={`Are you sure you want to delete "${deleteTarget?.fileName}"? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

function FileCard({ file, isPhoto, onDelete, compact }: { file: UploadedFile; isPhoto: boolean; onDelete: () => void; compact?: boolean }) {
  const isPdf = file.fileType === 'application/pdf';

  if (isPhoto && !compact) {
    return (
      <div className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square">
        <img src={file.publicUrl} alt={file.fileName} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
          <a href={file.publicUrl} download={file.fileName} className="p-2 rounded-lg bg-white/90 text-slate-700 hover:bg-white transition cursor-pointer" title="Download">
            <Download className="h-3.5 w-3.5" />
          </a>
          <button onClick={onDelete} className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition cursor-pointer" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
      <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${isPdf ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
        {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{file.fileName}</p>
        <p className="text-[10px] text-slate-400">{formatFileSize(file.fileSize)}</p>
      </div>
      <a href={file.publicUrl} download={file.fileName} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer" title="Download">
        <Download className="h-3.5 w-3.5" />
      </a>
      <button onClick={onDelete} className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition cursor-pointer" title="Delete">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
