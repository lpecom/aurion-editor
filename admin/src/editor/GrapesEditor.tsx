import { useEffect, useRef } from 'react';
import createStudioEditor from '@grapesjs/studio-sdk';
import { rteProseMirror, layoutSidebarButtons } from '@grapesjs/studio-sdk-plugins';
import '@grapesjs/studio-sdk/style';

const LICENSE_KEY = '8c93dd03c9f24371b288ff462cb73f5d078f0cafb90a42c5883923539fa3de15';

interface GrapesEditorProps {
  pageId: string;
}

export default function GrapesEditor({ pageId }: GrapesEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Ensure container has a unique ID for the SDK
    const containerId = `studio-editor-${pageId}`;
    containerRef.current.id = containerId;

    const editor = createStudioEditor({
      root: `#${containerId}`,
      licenseKey: LICENSE_KEY,
      project: {
        type: 'web',
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
          // Normalize response to expected format
          if (Array.isArray(result)) return result;
          // Single file upload response
          return [{ src: `/${result.path}`, name: result.filename || result.original_name }];
        },
        onDelete: async ({ assets }) => {
          for (const asset of assets) {
            const src = asset.getSrc();
            // Extract image ID from URL if possible
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
        onSave: async ({ project }) => {
          try {
            // Save project JSON + export HTML for publishing
            const files = await (editor as any).runCommand?.('studio:projectFiles', { styles: 'inline' });
            const htmlFile = files?.find((f: any) => f.mimeType === 'text/html');
            const htmlContent = htmlFile?.content || '';

            await fetch(`/api/pages/${pageId}/content`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                html_content: htmlContent,
                project_data: JSON.stringify(project),
              }),
            });
          } catch (err) {
            console.error('Failed to save page:', err);
            throw err;
          }
        },
        onLoad: async () => {
          try {
            const response = await fetch(`/api/pages/${pageId}`, {
              credentials: 'include',
            });
            if (!response.ok) {
              return {
                project: {
                  pages: [{ name: 'Home', component: '<h1>Nova página</h1>' }],
                },
              };
            }
            const data = await response.json();

            // If we have saved project_data (GrapesJS JSON), use it
            if (data.project_data) {
              try {
                const project = JSON.parse(data.project_data);
                return { project };
              } catch {
                // Fall through to HTML import
              }
            }

            // Otherwise import from raw HTML content
            const html = data.html_content || '<h1>Nova página</h1>';
            return {
              project: {
                pages: [{ name: data.title || 'Page', component: html }],
              },
            };
          } catch (err) {
            console.error('Failed to load page:', err);
            throw err;
          }
        },
      },
      plugins: [
        rteProseMirror.init({}),
        layoutSidebarButtons.init({}),
      ],
    });

    editorRef.current = editor;

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
}
