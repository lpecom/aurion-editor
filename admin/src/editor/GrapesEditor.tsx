import { useEffect, useRef, useCallback, useState } from 'react';
import grapesjs, { Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import './grapes-dark.css';
import blocksBasic from 'grapesjs-blocks-basic';
import presetWebpage from 'grapesjs-preset-webpage';
import blocksPV from './blocks-pv';
import blocksAdvertorial from './blocks-advertorial';

interface GrapesEditorProps {
  pageId: string;
  onSaveStatusChange?: (status: 'idle' | 'saving' | 'saved' | 'unsaved' | 'error') => void;
  onEditorReady?: (editor: Editor) => void;
}

export default function GrapesEditor({ pageId, onSaveStatusChange, onEditorReady }: GrapesEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const updateSaveStatus = useCallback(
    (status: 'idle' | 'saving' | 'saved' | 'unsaved' | 'error') => {
      onSaveStatusChange?.(status);
    },
    [onSaveStatusChange]
  );

  const saveContent = useCallback(async (editor: Editor) => {
    updateSaveStatus('saving');
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

      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      updateSaveStatus('saved');
    } catch (err) {
      console.error('Save error:', err);
      updateSaveStatus('error');
    }
  }, [pageId, updateSaveStatus]);

  const scheduleAutoSave = useCallback((editor: Editor) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    updateSaveStatus('unsaved');
    autoSaveTimerRef.current = setTimeout(() => {
      saveContent(editor);
    }, 30000);
  }, [saveContent, updateSaveStatus]);

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = grapesjs.init({
      container: containerRef.current,
      height: '100%',
      width: 'auto',
      fromElement: false,
      storageManager: false,
      plugins: [blocksBasic, presetWebpage, blocksPV, blocksAdvertorial],
      pluginsOpts: {
        [blocksBasic.toString()]: {
          flexGrid: true,
        },
      },
      canvas: {
        styles: [
          'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
        ],
      },
      deviceManager: {
        devices: [
          { name: 'Desktop', width: '' },
          { name: 'Tablet', width: '768px', widthMedia: '992px' },
          { name: 'Mobile', width: '375px', widthMedia: '480px' },
        ],
      },
      assetManager: {
        uploadName: 'file',
        credentials: 'include',
        assets: [],
        upload: `/api/images/upload`,
        headers: {},
        autoAdd: true,
      },
      styleManager: {
        sectors: [
          {
            name: 'Geral',
            open: true,
            properties: [
              'display',
              'float',
              'position',
              'top',
              'right',
              'bottom',
              'left',
            ],
          },
          {
            name: 'Dimensões',
            open: false,
            properties: [
              'width',
              'height',
              'max-width',
              'min-height',
              'margin',
              'padding',
            ],
          },
          {
            name: 'Tipografia',
            open: false,
            properties: [
              'font-family',
              'font-size',
              'font-weight',
              'letter-spacing',
              'color',
              'line-height',
              'text-align',
              'text-decoration',
              'text-shadow',
            ],
          },
          {
            name: 'Decoração',
            open: false,
            properties: [
              'background-color',
              'background',
              'border-radius',
              'border',
              'box-shadow',
              'opacity',
            ],
          },
          {
            name: 'Extra',
            open: false,
            properties: [
              'transition',
              'transform',
              'cursor',
              'overflow',
            ],
          },
        ],
      },
    });

    editorRef.current = editor;

    // Load page content from API
    (async () => {
      try {
        const res = await fetch(`/api/pages/${pageId}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.html_content) {
            // Separate HTML and CSS from combined content
            const styleMatch = data.html_content.match(/<style>([\s\S]*?)<\/style>/);
            const css = styleMatch ? styleMatch[1] : '';
            const html = data.html_content.replace(/<style>[\s\S]*?<\/style>/, '');
            editor.setComponents(html);
            if (css) {
              editor.setStyle(css);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load page content:', err);
      } finally {
        setIsLoading(false);
      }
    })();

    // Load images into asset manager
    (async () => {
      try {
        const res = await fetch('/api/images', { credentials: 'include' });
        if (res.ok) {
          const images = await res.json();
          if (Array.isArray(images)) {
            const assets = images.map((img: { url: string; filename?: string }) => ({
              src: img.url,
              name: img.filename || '',
              type: 'image',
            }));
            editor.AssetManager.add(assets);
          }
        }
      } catch {
        // Images API may not be available yet
      }
    })();

    // Listen for changes to schedule auto-save
    editor.on('component:update', () => scheduleAutoSave(editor));
    editor.on('component:add', () => scheduleAutoSave(editor));
    editor.on('component:remove', () => scheduleAutoSave(editor));
    editor.on('style:change', () => scheduleAutoSave(editor));

    onEditorReady?.(editor);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#020617',
          color: '#94A3B8',
          fontSize: '0.875rem',
          zIndex: 100,
        }}>
          Carregando editor...
        </div>
      )}
    </div>
  );
}
