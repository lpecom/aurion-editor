import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import createStudioEditor from '@grapesjs/studio-sdk';
import { rteProseMirror, layoutSidebarButtons } from '@grapesjs/studio-sdk-plugins';
import '@grapesjs/studio-sdk/style';

const LICENSE_KEY = '8c93dd03c9f24371b288ff462cb73f5d078f0cafb90a42c5883923539fa3de15';

interface GrapesEditorProps {
  pageId: string;
  onWarning?: (message: string) => void;
}

export interface GrapesEditorRef {
  save: () => Promise<void>;
}

const GrapesEditor = forwardRef<GrapesEditorRef, GrapesEditorProps>(function GrapesEditor({ pageId, onWarning }, ref) {
  const onWarningRef = useRef(onWarning);
  onWarningRef.current = onWarning;
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    save: async () => {
      const gjsEditor = editorRef.current;
      if (!gjsEditor) return;
      await gjsEditor.store();
    },
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;

    const containerId = `studio-editor-${pageId}`;
    containerRef.current.id = containerId;

    createStudioEditor({
      root: `#${containerId}`,
      licenseKey: LICENSE_KEY,
      project: {
        type: 'web',
      },
      onEditor: (gjsEditor) => {
        editorRef.current = gjsEditor;
      },
      assets: {
        storageType: 'self',
        onUpload: async ({ files }) => {
          const body = new FormData();
          for (const file of files) {
            body.append('files', file);
          }
          const response = await fetch('/api/images/upload', {
            method: 'POST',
            credentials: 'include',
            body,
          });
          const result = await response.json();
          if (Array.isArray(result)) return result;
          return [{ src: `/${result.path}`, name: result.filename || result.original_name }];
        },
        onDelete: async ({ assets }) => {
          for (const asset of assets) {
            const src = asset.getSrc();
            const match = src.match(/\/api\/images\/([^/]+)/);
            if (match) {
              await fetch(`/api/images/${match[1]}`, {
                method: 'DELETE',
                credentials: 'include',
              });
            }
          }
        },
      },
      storage: {
        type: 'self',
        autosaveChanges: 100,
        autosaveIntervalMs: 10000,
        onSave: async ({ project, editor: gjsEditor }) => {
          try {
            const files = await gjsEditor.runCommand('studio:projectFiles', { styles: 'inline' });
            const htmlFile = files?.find((f: any) => f.mimeType === 'text/html');
            const htmlContent = htmlFile?.content;

            const payload: Record<string, string> = {
              project_data: JSON.stringify(project),
            };
            if (htmlContent) {
              payload.html_content = htmlContent;
            } else {
              onWarningRef.current?.('Export HTML falhou — salvando apenas dados do projeto. Re-salve antes de publicar.');
            }

            await fetch(`/api/pages/${pageId}/content`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(payload),
            });
          } catch (err) {
            console.error('Failed to save page:', err);
            onWarningRef.current?.(`Falha ao salvar: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
            throw err;
          }
        },
        onLoad: async () => {
          try {
            const response = await fetch(`/api/pages/${pageId}`, {
              credentials: 'include',
            });
            if (!response.ok) {
              onWarningRef.current?.(`Falha ao carregar página (HTTP ${response.status}) — usando template padrão`);
              return {
                project: {
                  pages: [{ name: 'Home', component: '<h1>Nova página</h1>' }],
                },
              };
            }
            const data = await response.json();

            if (data.project_data) {
              try {
                const project = JSON.parse(data.project_data);
                return { project };
              } catch {
                onWarningRef.current?.('project_data corrompido — importando do HTML bruto');
              }
            }

            const html = data.html_content || '<h1>Nova página</h1>';
            return {
              project: {
                pages: [{ name: data.title || 'Page', component: html }],
              },
            };
          } catch (err) {
            console.error('Failed to load page:', err);
            onWarningRef.current?.(`Falha ao carregar página: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
            throw err;
          }
        },
      },
      plugins: [
        rteProseMirror.init({}),
        layoutSidebarButtons.init({}),
      ],
    });

    return () => {
      if (editorRef.current) {
        try {
          editorRef.current.destroy?.();
        } catch {
          // SDK cleanup failed, ignore
        }
      }
      editorRef.current = null;
    };
  }, [pageId]);

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', width: '100%' }}
    />
  );
});

export default GrapesEditor;
