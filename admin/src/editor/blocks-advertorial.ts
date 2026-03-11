import type { Editor } from 'grapesjs';

export default function blocksAdvertorial(editor: Editor) {
  const bm = editor.Blocks;

  bm.add('header-jornal', {
    label: 'Header de Jornal',
    category: 'Advertorial',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
    content: `<header style="border-bottom:2px solid #333;padding:15px 20px;display:flex;justify-content:space-between;align-items:center">
  <div style="font-family:Georgia,serif;font-size:1.5rem;font-weight:bold">Portal de Notícias</div>
  <div style="color:#666;font-size:0.875rem">12 de Março, 2026 • Saúde</div>
</header>`,
  });

  bm.add('artigo-body', {
    label: 'Artigo Body',
    category: 'Advertorial',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h16M4 10h16M4 14h10M4 18h12"/></svg>',
    content: `<article style="max-width:720px;margin:0 auto;padding:40px 20px;font-family:Georgia,serif;line-height:1.8;color:#333">
  <h1 style="font-size:2rem;line-height:1.3;margin-bottom:15px;font-family:Georgia,serif">Título do Artigo Editorial Aqui</h1>
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:30px;color:#666;font-size:0.875rem">
    <span>Por <strong>Dr. Nome Sobrenome</strong></span>
    <span>•</span>
    <span>12 de Março, 2026</span>
    <span>•</span>
    <span>5 min de leitura</span>
  </div>
  <p style="font-size:1.125rem;margin-bottom:20px">Parágrafo introdutório do artigo com informações relevantes que capturam a atenção do leitor. Este texto deve ser escrito em estilo editorial, como uma matéria jornalística.</p>
  <p style="font-size:1.125rem;margin-bottom:20px">Segundo parágrafo com mais detalhes sobre o tema. Aqui você pode incluir dados, estatísticas e informações que dão credibilidade ao conteúdo.</p>
  <p style="font-size:1.125rem;margin-bottom:20px">Terceiro parágrafo continuando a narrativa. O texto deve fluir naturalmente, como um artigo de revista ou jornal de qualidade.</p>
</article>`,
  });

  bm.add('citacao', {
    label: 'Citação',
    category: 'Advertorial',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></svg>',
    content: `<blockquote style="max-width:720px;margin:30px auto;padding:20px 30px;border-left:4px solid #22C55E;background:#f8f9fa;font-family:Georgia,serif;font-style:italic;font-size:1.2rem;color:#555;line-height:1.6">
  "Citação de um especialista ou depoimento relevante que reforça a credibilidade do artigo."
  <footer style="margin-top:10px;font-style:normal;font-size:0.875rem;color:#999">— Dr. Nome Sobrenome, Especialista em Área</footer>
</blockquote>`,
  });

  bm.add('imagem-editorial', {
    label: 'Imagem Editorial',
    category: 'Advertorial',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    content: `<figure style="max-width:720px;margin:30px auto;padding:0 20px">
  <img src="https://placehold.co/720x400" alt="Imagem editorial" style="width:100%;border-radius:8px"/>
  <figcaption style="text-align:center;color:#999;font-size:0.875rem;margin-top:10px;font-family:Georgia,serif;font-style:italic">Legenda da imagem editorial (Foto: Reprodução)</figcaption>
</figure>`,
  });

  bm.add('cta-nativo', {
    label: 'CTA Nativo',
    category: 'Advertorial',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    content: `<div style="max-width:720px;margin:30px auto;padding:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-family:Georgia,serif">
  <p style="margin:0 0 10px;color:#333;font-size:1rem;line-height:1.6">Para conhecer mais sobre esta solução inovadora e como ela pode transformar seus resultados, acesse o site oficial clicando no botão abaixo.</p>
  <a href="#" style="display:inline-block;color:#22C55E;font-weight:bold;text-decoration:underline;font-size:1rem">→ Saiba mais sobre o produto</a>
</div>`,
  });

  bm.add('comentarios-fake', {
    label: 'Comentários',
    category: 'Advertorial',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>',
    content: `<section style="max-width:720px;margin:40px auto;padding:0 20px;font-family:-apple-system,sans-serif">
  <h3 style="font-size:1.1rem;color:#333;margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid #e5e7eb">3 Comentários</h3>
  <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f3f4f6">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="width:36px;height:36px;border-radius:50%;background:#3b82f6;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:0.875rem">CS</div>
      <div><strong style="font-size:0.875rem;color:#333">Carlos S.</strong> <span style="color:#999;font-size:0.75rem">• há 2 horas</span></div>
    </div>
    <p style="margin:0;color:#555;font-size:0.9rem;line-height:1.5;padding-left:46px">Matéria excelente! Já estou usando e os resultados são impressionantes.</p>
  </div>
  <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f3f4f6">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="width:36px;height:36px;border-radius:50%;background:#ec4899;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:0.875rem">PL</div>
      <div><strong style="font-size:0.875rem;color:#333">Patricia L.</strong> <span style="color:#999;font-size:0.75rem">• há 5 horas</span></div>
    </div>
    <p style="margin:0;color:#555;font-size:0.9rem;line-height:1.5;padding-left:46px">Muito bom o artigo. Compartilhei com minha família.</p>
  </div>
  <div style="margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="width:36px;height:36px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:0.875rem">RM</div>
      <div><strong style="font-size:0.875rem;color:#333">Roberto M.</strong> <span style="color:#999;font-size:0.75rem">• há 1 dia</span></div>
    </div>
    <p style="margin:0;color:#555;font-size:0.9rem;line-height:1.5;padding-left:46px">Finalmente uma matéria séria sobre o assunto. Parabéns ao portal!</p>
  </div>
</section>`,
  });
}
