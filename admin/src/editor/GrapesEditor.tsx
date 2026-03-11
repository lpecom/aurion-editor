import { useCallback, useState, useEffect } from 'react';
import StudioEditor from '@grapesjs/studio-sdk/react';
import '@grapesjs/studio-sdk/style';

interface GrapesEditorProps {
  pageId: string;
  initialContent?: string;
  onSave?: () => void;
}

export default function GrapesEditor({ pageId, initialContent, onSave }: GrapesEditorProps) {
  const [projectData, setProjectData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pages/${pageId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        if (cancelled) return;

        const html = data.html_content || initialContent || '<h1>Nova página</h1>';
        setProjectData({
          pages: [{ name: data.title || 'Page', component: html }],
        });
      } catch {
        if (!cancelled) {
          setProjectData({
            pages: [{ name: 'Page', component: initialContent || '<h1>Nova página</h1>' }],
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pageId, initialContent]);

  const handleSave = useCallback(async ({ project, editor }: { project: unknown; editor: unknown }) => {
    try {
      // Get HTML files from the project
      const files = await (editor as any).runCommand('studio:projectFiles', { styles: 'inline' });
      const htmlFile = files?.find((f: any) => f.mimeType === 'text/html');
      const htmlContent = htmlFile?.content || '';

      const res = await fetch(`/api/pages/${pageId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          html_content: htmlContent,
          project_data: JSON.stringify(project),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      onSave?.();
    } catch (err) {
      console.error('Save error:', err);
    }
  }, [pageId, onSave]);

  const handleUpload = useCallback(async ({ files }: { files: File[] }) => {
    const results = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/images/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          results.push({
            id: data.id || data.url,
            src: data.url,
            name: data.filename || file.name,
            mimeType: file.type,
            size: file.size,
          });
        }
      } catch {
        // Skip failed uploads
      }
    }
    return results;
  }, []);

  if (loading || !projectData) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#020617',
        color: '#94A3B8',
        fontSize: '0.875rem',
      }}>
        Carregando editor...
      </div>
    );
  }

  return (
    <StudioEditor
      options={{
        licenseKey: 'DEV_LICENSE_KEY',
        theme: 'dark',
        project: {
          type: 'web',
          default: projectData as any,
        },
        storage: {
          type: 'self',
          autosaveChanges: 5,
          autosaveIntervalMs: 30000,
          project: projectData,
          onSave: handleSave as any,
        },
        assets: {
          storageType: 'self',
          onUpload: handleUpload as any,
        },
      }}
    />
  );
}
