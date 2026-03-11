import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft, Globe } from 'lucide-react';
import GrapesEditor from '../editor/GrapesEditor';
import PublishModal from '../components/PublishModal';

interface PageData {
  id: string;
  title: string;
  slug?: string;
  type?: string;
  status?: string;
  category_id?: string | null;
}

export default function EditorPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<PageData | null>(null);
  const [showPublish, setShowPublish] = useState(false);

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
          onClick={() => setShowPublish(true)}
          style={{
            background: '#22C55E',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: '5px 14px',
            borderRadius: 6,
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
          title="Publicar"
        >
          <Globe size={13} />
          Publicar
        </button>
      </header>

      {/* Studio Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <GrapesEditor pageId={pageId} />
      </div>

      {/* Publish Modal */}
      <PublishModal
        open={showPublish}
        onClose={() => setShowPublish(false)}
        pageId={pageId}
        pageType={page?.type || 'pv'}
        currentCategoryId={page?.category_id}
        currentSlug={page?.slug}
      />
    </div>
  );
}
