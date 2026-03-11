import type { Editor } from 'grapesjs';

export default function blocksPV(editor: Editor) {
  const bm = editor.Blocks;

  bm.add('hero-produto', {
    label: 'Hero de Produto',
    category: 'PV - Vendas',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17h8"/></svg>',
    content: `<section style="text-align:center;padding:60px 20px;background:#f8f9fa">
  <img src="https://placehold.co/400x300" alt="Produto" style="max-width:400px;border-radius:12px"/>
  <h1 style="font-size:2.5rem;margin:20px 0">Título do Produto</h1>
  <p style="font-size:1.2rem;color:#666;max-width:600px;margin:0 auto 30px">Subtítulo persuasivo aqui</p>
  <a href="#" style="display:inline-block;background:#22C55E;color:#fff;padding:16px 40px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:1.1rem">COMPRAR AGORA</a>
</section>`,
  });

  bm.add('beneficios', {
    label: 'Benefícios',
    category: 'PV - Vendas',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    content: `<section style="padding:60px 20px;max-width:900px;margin:0 auto">
  <h2 style="text-align:center;margin-bottom:40px">Benefícios</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:30px">
    <div style="text-align:center"><div style="font-size:2rem;margin-bottom:10px">✓</div><h3>Benefício 1</h3><p style="color:#666">Descrição do benefício</p></div>
    <div style="text-align:center"><div style="font-size:2rem;margin-bottom:10px">✓</div><h3>Benefício 2</h3><p style="color:#666">Descrição do benefício</p></div>
    <div style="text-align:center"><div style="font-size:2rem;margin-bottom:10px">✓</div><h3>Benefício 3</h3><p style="color:#666">Descrição do benefício</p></div>
  </div>
</section>`,
  });

  bm.add('depoimentos', {
    label: 'Depoimentos',
    category: 'PV - Vendas',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    content: `<section style="padding:60px 20px;background:#f8f9fa">
  <h2 style="text-align:center;margin-bottom:40px">O que dizem nossos clientes</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:30px;max-width:1000px;margin:0 auto">
    <div style="background:#fff;padding:30px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      <div style="color:#f59e0b;margin-bottom:10px">★★★★★</div>
      <p style="color:#333;margin-bottom:15px;font-style:italic">"Depoimento do cliente aqui. Resultado incrível!"</p>
      <p style="font-weight:bold;color:#333;margin:0">Maria S.</p>
      <p style="color:#999;font-size:0.875rem;margin:0">São Paulo, SP</p>
    </div>
    <div style="background:#fff;padding:30px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      <div style="color:#f59e0b;margin-bottom:10px">★★★★★</div>
      <p style="color:#333;margin-bottom:15px;font-style:italic">"Outro depoimento positivo do cliente."</p>
      <p style="font-weight:bold;color:#333;margin:0">João P.</p>
      <p style="color:#999;font-size:0.875rem;margin:0">Rio de Janeiro, RJ</p>
    </div>
    <div style="background:#fff;padding:30px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      <div style="color:#f59e0b;margin-bottom:10px">★★★★★</div>
      <p style="color:#333;margin-bottom:15px;font-style:italic">"Mais um depoimento convincente aqui."</p>
      <p style="font-weight:bold;color:#333;margin:0">Ana L.</p>
      <p style="color:#999;font-size:0.875rem;margin:0">Belo Horizonte, MG</p>
    </div>
  </div>
</section>`,
  });

  bm.add('faq', {
    label: 'FAQ',
    category: 'PV - Vendas',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M9 9a3 3 0 015.12 2.13c0 1.5-2.12 2.12-2.12 3.37"/><circle cx="12" cy="17.5" r="0.5" fill="currentColor"/></svg>',
    content: `<section style="padding:60px 20px;max-width:700px;margin:0 auto">
  <h2 style="text-align:center;margin-bottom:40px">Perguntas Frequentes</h2>
  <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <details style="border-bottom:1px solid #e5e7eb">
      <summary style="padding:20px;font-weight:bold;cursor:pointer;background:#fff">Pergunta frequente 1?</summary>
      <div style="padding:0 20px 20px;color:#666">Resposta detalhada para a pergunta frequente 1.</div>
    </details>
    <details style="border-bottom:1px solid #e5e7eb">
      <summary style="padding:20px;font-weight:bold;cursor:pointer;background:#fff">Pergunta frequente 2?</summary>
      <div style="padding:0 20px 20px;color:#666">Resposta detalhada para a pergunta frequente 2.</div>
    </details>
    <details>
      <summary style="padding:20px;font-weight:bold;cursor:pointer;background:#fff">Pergunta frequente 3?</summary>
      <div style="padding:0 20px 20px;color:#666">Resposta detalhada para a pergunta frequente 3.</div>
    </details>
  </div>
</section>`,
  });

  bm.add('cta-final', {
    label: 'CTA Final',
    category: 'PV - Vendas',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
    content: `<section style="text-align:center;padding:60px 20px;background:linear-gradient(135deg,#065f46,#22C55E)">
  <h2 style="color:#fff;font-size:2rem;margin-bottom:10px">Não perca essa oportunidade!</h2>
  <p style="color:rgba(255,255,255,0.9);font-size:1.1rem;margin-bottom:10px">Oferta por tempo limitado</p>
  <div style="margin-bottom:20px">
    <span style="color:rgba(255,255,255,0.7);text-decoration:line-through;font-size:1.2rem">De R$ 297,00</span>
    <span style="display:block;color:#fff;font-size:2.5rem;font-weight:bold">R$ 97,00</span>
  </div>
  <a href="#" style="display:inline-block;background:#fff;color:#065f46;padding:18px 50px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:1.2rem">QUERO GARANTIR O MEU</a>
  <p style="color:rgba(255,255,255,0.8);font-size:0.875rem;margin-top:15px">Pagamento 100% seguro • Garantia de 7 dias</p>
</section>`,
  });

  bm.add('garantia', {
    label: 'Garantia',
    category: 'PV - Vendas',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    content: `<section style="padding:60px 20px;max-width:700px;margin:0 auto;text-align:center">
  <div style="display:inline-flex;align-items:center;gap:20px;background:#f0fdf4;padding:30px 40px;border-radius:16px;border:2px solid #22C55E">
    <div style="font-size:4rem">🛡️</div>
    <div style="text-align:left">
      <h3 style="margin:0 0 8px;font-size:1.3rem;color:#166534">Garantia Incondicional de 7 Dias</h3>
      <p style="margin:0;color:#333;line-height:1.5">Se por qualquer motivo você não ficar satisfeito, devolvemos 100% do seu dinheiro. Sem perguntas, sem burocracia.</p>
    </div>
  </div>
</section>`,
  });

  bm.add('video-embed', {
    label: 'Video Embed',
    category: 'PV - Vendas',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    content: `<section style="padding:40px 20px;max-width:800px;margin:0 auto">
  <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15)">
    <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen></iframe>
  </div>
</section>`,
  });
}
