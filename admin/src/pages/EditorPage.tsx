import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Save,
  ExternalLink,
  Globe,
  Settings,
  Monitor,
  Tablet,
  Smartphone,
  Loader2,
} from 'lucide-react';
import type { Editor } from 'grapesjs';
import GrapesEditor from '../editor/GrapesEditor';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved' | 'error';

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [page, setPage] = useState<PageData | null>(null);
  const [publishing, setPublishing] = useState(false);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    if (!pageId) return;
    (async () => {
      try {
        const res = await fetch(`/api/pages/${pageId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setPage(data);
        }
      } catch {
        // Page load failed
      }
    })();
  }, [pageId]);

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const handleManualSave = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || !pageId) return;

    setSaveStatus('saving');
    try {
      const html = editor.getHtml();
      const css = editor.getCss();
      const htmlContent = css ? `${html}<style>${css}</style>` : html;

      const res = await fetch(`/api/pages/${pageId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ html_content: htmlContent }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
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

  const handlePreview = useCallback(() => {
    if (page?.slug) {
      window.open(`/${page.slug}`, '_blank');
    } else if (pageId) {
      window.open(`/p/${pageId}`, '_blank');
    }
  }, [page, pageId]);

  const handleDeviceChange = useCallback((device: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setDevice(device);
  }, []);

  if (!pageId) return null;

  const saveStatusLabel: Record<SaveStatus, string> = {
    idle: '',
    saving: 'Salvando...',
    saved: 'Salvo',
    unsaved: 'Não salvo',
    error: 'Erro ao salvar',
  };

  const saveStatusColor: Record<SaveStatus, string> = {
    idle: '#94A3B8',
    saving: '#F59E0B',
    saved: '#22C55E',
    unsaved: '#94A3B8',
    error: '#EF4444',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#020617' }}>
      {/* Toolbar */}
      <header
        style={{
          height: 48,
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
        {/* Left: Back + Title */}
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94A3B8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '6px 8px',
            borderRadius: 6,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#F8FAFC')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
          title="Voltar"
        >
          <ArrowLeft size={18} />
        </button>

        <span
          style={{
            color: '#F8FAFC',
            fontSize: '0.875rem',
            fontWeight: 500,
            marginRight: 'auto',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 260,
          }}
        >
          {page?.title || 'Carregando...'}
        </span>

        {/* Center: Device switcher */}
        <div style={{ display: 'flex', gap: 2, marginRight: 'auto' }}>
          {[
            { device: 'Desktop', icon: Monitor },
            { device: 'Tablet', icon: Tablet },
            { device: 'Mobile', icon: Smartphone },
          ].map(({ device, icon: Icon }) => (
            <button
              key={device}
              onClick={() => handleDeviceChange(device)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '6px 8px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#F8FAFC')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
              title={device}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>

        {/* Right: Save status + actions */}
        {saveStatus !== 'idle' && (
          <span
            style={{
              fontSize: '0.75rem',
              color: saveStatusColor[saveStatus],
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {saveStatus === 'saving' && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            {saveStatusLabel[saveStatus]}
          </span>
        )}

        <button
          onClick={handleManualSave}
          disabled={saveStatus === 'saving'}
          style={{
            background: 'none',
            border: '1px solid #334155',
            color: '#F8FAFC',
            cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: saveStatus === 'saving' ? 0.5 : 1,
          }}
          title="Salvar (Ctrl+S)"
        >
          <Save size={14} />
          Salvar
        </button>

        <button
          onClick={handlePreview}
          style={{
            background: 'none',
            border: '1px solid #334155',
            color: '#F8FAFC',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          title="Preview"
        >
          <ExternalLink size={14} />
          Preview
        </button>

        <button
          onClick={handlePublish}
          disabled={publishing}
          style={{
            background: '#22C55E',
            border: 'none',
            color: '#fff',
            cursor: publishing ? 'not-allowed' : 'pointer',
            padding: '6px 16px',
            borderRadius: 6,
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: publishing ? 0.7 : 1,
          }}
          title="Publicar"
        >
          <Globe size={14} />
          {publishing ? 'Publicando...' : 'Publicar'}
        </button>

        <button
          style={{
            background: 'none',
            border: 'none',
            color: '#94A3B8',
            cursor: 'pointer',
            padding: '6px 8px',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#F8FAFC')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
          title="Configurações"
        >
          <Settings size={16} />
        </button>
      </header>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <GrapesEditor
          pageId={pageId}
          onSaveStatusChange={setSaveStatus}
          onEditorReady={handleEditorReady}
        />
      </div>

      {/* Spin animation for Loader2 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
