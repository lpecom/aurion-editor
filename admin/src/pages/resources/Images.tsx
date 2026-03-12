import { useState, useEffect, useCallback, useRef } from 'react';
import { Image, Upload, Search, Copy, Trash2, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import ResourceFolderNav from '../../components/ResourceFolderNav';

interface ImageItem {
  id: number;
  filename: string;
  original_name: string;
  path: string;
  size: number;
  mime_type: string;
  width: number;
  height: number;
  created_at: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Images() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ImageItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ImageItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = useCallback(async () => {
    try {
      const data = await api.get<ImageItem[]>('/images');
      setImages(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const names = fileArray.map((f) => f.name);
    setUploading((prev) => [...prev, ...names]);

    for (const file of fileArray) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        await fetch('/api/images/upload', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });
      } catch {
        // silently fail per file
      } finally {
        setUploading((prev) => prev.filter((n) => n !== file.name));
      }
    }
    fetchImages();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/images/${deleteTarget.id}`);
      setImages((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(null);
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const copyUrl = (filename: string) => {
    navigator.clipboard.writeText(`/assets/imgs/${filename}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = images.filter((img) =>
    img.filename.toLowerCase().includes(search.toLowerCase()) ||
    img.original_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex -m-6 h-[calc(100vh-3.5rem)]">
      <ResourceFolderNav selectedPageId={selectedPageId} onSelectPage={setSelectedPageId} />
      <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-accent/10 p-2.5">
            <Image className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Imagens</h1>
            <p className="text-sm text-text-muted">Gerencie suas imagens e arquivos de mídia.</p>
          </div>
        </div>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-6 border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
          dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-surface-2/30'
        }`}
      >
        <div className={`rounded-2xl bg-surface-2/50 p-4 mb-3 transition-transform duration-200 ${dragOver ? 'scale-110' : ''}`}>
          <Upload className="w-8 h-8 text-text-muted" />
        </div>
        <p className="text-text font-medium text-sm">Arraste imagens aqui ou clique para enviar</p>
        <p className="text-text-muted text-xs mt-1">JPEG, PNG, WebP, SVG</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {/* Uploading indicators */}
      {uploading.length > 0 && (
        <div className="mb-4 space-y-2">
          {uploading.map((name) => (
            <div key={name} className="flex items-center gap-2 text-sm text-text-muted bg-surface border border-border rounded-md px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Enviando {name}...</span>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      {!loading && images.length > 0 && (
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar imagens..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-2 border border-border text-text text-sm rounded-md pl-9 pr-3 py-2 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
          />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden animate-pulse">
              <div className="w-full h-40 bg-surface-2" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-surface-2 rounded w-3/4" />
                <div className="h-3 bg-surface-2 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={Image}
          title="Nenhuma imagem encontrada"
          description="Nenhuma imagem encontrada. Faca upload da sua primeira imagem."
        />
      )}

      {/* Image grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map((img) => (
            <div
              key={img.id}
              onClick={() => setSelected(img)}
              className="group bg-surface border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
            >
              <div className="w-full h-40 bg-surface-2 flex items-center justify-center overflow-hidden">
                <img
                  src={`/assets/imgs/${img.filename}`}
                  alt={img.original_name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                <p className="text-text text-sm font-medium truncate">{img.original_name}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                  {img.width > 0 && <span>{img.width}x{img.height}</span>}
                  <span>{formatSize(img.size)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Detalhes da imagem"
        maxWidth="max-w-2xl"
        footer={
          <>
            <button
              onClick={() => selected && copyUrl(selected.filename)}
              className="flex items-center gap-2 bg-surface-2 border border-border text-text px-4 py-2 rounded-md hover:bg-surface-2/80 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copiado!' : 'Copiar URL'}
            </button>
            <button
              onClick={() => {
                if (selected) {
                  setDeleteTarget(selected);
                  setSelected(null);
                }
              }}
              className="flex items-center gap-2 bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 px-4 py-2 rounded-md cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-danger/50 focus:outline-none"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="bg-surface-2 rounded-xl overflow-hidden flex items-center justify-center min-h-[200px]">
              <img
                src={`/assets/imgs/${selected.filename}`}
                alt={selected.original_name}
                className="max-w-full max-h-96 object-contain"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-surface-2/50 rounded-lg p-3">
                <p className="text-text-muted text-xs mb-1">Arquivo</p>
                <p className="text-text font-medium truncate">{selected.filename}</p>
              </div>
              <div className="bg-surface-2/50 rounded-lg p-3">
                <p className="text-text-muted text-xs mb-1">Nome original</p>
                <p className="text-text font-medium truncate">{selected.original_name}</p>
              </div>
              <div className="bg-surface-2/50 rounded-lg p-3">
                <p className="text-text-muted text-xs mb-1">Tamanho</p>
                <p className="text-text font-medium">{formatSize(selected.size)}</p>
              </div>
              <div className="bg-surface-2/50 rounded-lg p-3">
                <p className="text-text-muted text-xs mb-1">Dimensoes</p>
                <p className="text-text font-medium">{selected.width}x{selected.height}</p>
              </div>
              <div className="bg-surface-2/50 rounded-lg p-3">
                <p className="text-text-muted text-xs mb-1">Tipo MIME</p>
                <p className="text-text font-medium">{selected.mime_type}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={`Deseja excluir a imagem "${deleteTarget?.original_name}"? Esta acao nao pode ser desfeita.`}
      />
      </div>
    </div>
  );
}
