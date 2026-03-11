import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Globe } from 'lucide-react';
import GrapesEditor from '../editor/GrapesEditor';

interface PageData {
  id: string;
  title: string;
  slug?: string;
  type?: string;
  status?: string;
}

export default function EditorPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<PageData | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!pageId) return;
    (async () => {
      try {
        const res = await fetch(`/api/pages/${pageId}`, { credentials: 'include' });
        if (res.ok) setPage(await res.json());
      } catch {
        // Page load failed
      }
    })();
  }, [pageId]);

  const handlePublish = useCallback(async () => {
    if (!pageId) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Publish failed');
    } catch {
      // Publish error
    } finally {
      setPublishing(false);
    }
  }, [pageId]);

  if (!pageId) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#020617' }}>
      {/* Minimal top bar */}
      <header
        style={{
          height: 42,
          background: '#0F172A',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94A3B8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '4px 6px',
            borderRadius: 6,
          }}
          title="Voltar"
        >
          <ArrowLeft size={16} />
        </button>

        <span
          style={{
            color: '#F8FAFC',
            fontSize: '0.8125rem',
            fontWeight: 500,
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {page?.title || 'Carregando...'}
        </span>

        <button
          onClick={handlePublish}
          disabled={publishing}
          style={{
            background: '#22C55E',
            border: 'none',
            color: '#fff',
            cursor: publishing ? 'not-allowed' : 'pointer',
            padding: '5px 14px',
            borderRadius: 6,
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            opacity: publishing ? 0.7 : 1,
          }}
          title="Publicar"
        >
          <Globe size={13} />
          {publishing ? 'Publicando...' : 'Publicar'}
        </button>
      </header>

      {/* Studio Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <GrapesEditor pageId={pageId} />
      </div>
    </div>
  );
}
