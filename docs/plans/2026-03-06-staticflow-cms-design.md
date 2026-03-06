# StaticFlow CMS — Design Document

**Data:** 2026-03-06
**Status:** Aprovado

---

## Visão Geral

Framework estático minimalista para servir páginas HTML com rotas limpas, assets otimizados e zero dependência de banco de dados. O projeto é um **framework genérico reutilizável** — não um site específico.

**Princípios:**
- Zero JS no servidor
- Rota limpa por convenção de nome de arquivo
- Build explícito: você sabe exatamente o que está no ar
- Portabilidade total: qualquer servidor que sirva arquivos estáticos
- Dev experience simples: editar um `.html` = publicar uma página

---

## Estrutura de Arquivos

```
advfactory/
│
├── bin/
│   └── staticflow.js        <- Entry point CLI
│
├── lib/
│   ├── clean.js             <- Limpa dist/
│   ├── pages.js             <- Lê pages/, injeta partials, minifica, escreve dist/
│   ├── assets.js            <- Hash MD5 + copia assets + otimiza imagens/css/js
│   ├── sitemap.js           <- Gera sitemap.xml
│   └── redirects.js         <- Gera _redirects para Cloudflare Pages
│
├── template/                <- Kit inicial que o usuário usa como ponto de partida
│   ├── pages/
│   │   ├── index.html
│   │   └── sobre.html
│   ├── assets/
│   │   ├── imgs/
│   │   ├── fonts/
│   │   ├── icons/
│   │   └── js/
│   ├── css/
│   │   ├── global.css
│   │   └── components/
│   ├── partials/
│   │   ├── head.html        <- Aceita {{title}}, {{description}}, {{image}} do frontmatter
│   │   ├── header.html      <- Estático
│   │   └── footer.html      <- Estático
│   └── config.json
│
├── build.js                 <- Orquestrador principal (~50 linhas)
├── package.json
└── README.md
```

**Decisao de arquitetura:** Single-file build script com módulos em `lib/`. O `build.js` é o orquestrador (~50 linhas) e cada módulo em `lib/` tem uma responsabilidade única e menos de 150 linhas. Mantém simplicidade sem esconder lógica.

---

## Pipeline de Build

**Ordem de execução (`npm run build`):**

### 1. clean.js
- Remove `dist/` completamente
- Recria a pasta vazia

### 2. assets.js
- Percorre recursivamente `template/assets/` e `template/css/`
- Para cada arquivo:
  - Calcula `MD5(conteúdo).substring(0, 8)` como hash
  - Renomeia: `logo.png` → `logo.a3f9b2c1.png`
  - Otimizações por tipo:
    - `.jpg` / `.png` → sharp (compressão, qualidade 85 para jpg, lossless para png)
    - `.js` → terser (minify + mangle)
    - `.css` → clean-css (minify)
    - `.svg` → copia sem alteração (minificação de SVG é fase 2)
    - Fontes / outros → copia direta
  - Escreve em `dist/assets/` e `dist/css/`
- Grava `dist/asset-manifest.json`:
  ```json
  {
    "assets/imgs/logo.png": "assets/imgs/logo.a3f9b2c1.png",
    "css/global.css": "css/global.a1b2c3d4.css"
  }
  ```

### 3. pages.js
- Percorre recursivamente `template/pages/`
- Para cada `.html`:
  1. Lê frontmatter do comentário no topo da página:
     ```html
     <!--
       title: Sobre Nós
       description: Conheça nossa equipe
       image: assets/imgs/sobre-og.jpg
     -->
     ```
  2. Injeta partials: substitui `<!-- @partial:nome -->` pelo conteúdo de `template/partials/nome.html`
  3. No partial `head.html`, substitui `{{title}}`, `{{description}}`, `{{image}}` pelos valores do frontmatter (fallback para os valores de `config.json`)
  4. Substitui todas as referências de assets pelo nome hashed (usando `asset-manifest.json`)
  5. Minifica HTML com `html-minifier-terser`
  6. Escreve no destino seguindo a regra de roteamento

### 4. sitemap.js
- Lê todas as rotas geradas em `dist/`
- Escreve `dist/sitemap.xml` com `<url>` para cada página
- Usa `config.json > site.url` como base da URL

### 5. redirects.js
- Escreve `dist/_redirects` para Cloudflare Pages:
  ```
  /sitemap.xml  /sitemap.xml  200
  /*            /404/index.html  404
  ```
- Cloudflare Pages serve `dist/sobre/index.html` para `/sobre` nativamente

---

## Sistema de Roteamento

| Arquivo em `pages/`         | URL publica       | Destino em `dist/`                |
|-----------------------------|-------------------|-----------------------------------|
| `index.html`                | `/`               | `dist/index.html`                 |
| `sobre.html`                | `/sobre`          | `dist/sobre/index.html`           |
| `contato.html`              | `/contato`        | `dist/contato/index.html`         |
| `blog/index.html`           | `/blog`           | `dist/blog/index.html`            |
| `blog/post-1.html`          | `/blog/post-1`    | `dist/blog/post-1/index.html`     |
| `404.html`                  | `/404`            | `dist/404/index.html`             |

**Regra:** se o arquivo é `index.html`, copia direto mantendo o caminho. Qualquer outro arquivo vira uma pasta com `index.html` dentro.

---

## Sistema de Partials

Comentarios HTML como ancoras de injecao:

```html
<!--
  title: Sobre Nos
  description: Conheca nossa equipe
-->
<!-- @partial:head -->
<!-- @partial:header -->

<main>
  <!-- conteudo da pagina -->
</main>

<!-- @partial:footer -->
```

- `header.html` e `footer.html` sao 100% estaticos
- `head.html` aceita variaveis `{{title}}`, `{{description}}`, `{{image}}` do frontmatter
- Fallback: se a pagina nao tem frontmatter, usa os valores de `config.json > site`

---

## Dev Mode

**Comando:** `npm run dev`

- `chokidar` observa: `template/pages/`, `template/partials/`, `template/assets/`, `template/css/`
- Ao detectar mudanca: roda pipeline completo
- Output no terminal: `[HH:MM:SS] rebuilt in Xms — N pages, N assets`
- Servidor estatico simples em `localhost:3000` apontando para `dist/`
- Reload manual pelo usuario (sem WebSocket / HMR)

---

## Dependencias

```json
{
  "dependencies": {},
  "devDependencies": {
    "html-minifier-terser": "^7.x",
    "terser": "^5.x",
    "clean-css": "^5.x",
    "sharp": "^0.33.x",
    "glob": "^10.x",
    "chokidar": "^3.x"
  }
}
```

Zero dependencias em runtime. Todas as dependencias sao apenas para o build.

---

## Configuracao (`config.json`)

```json
{
  "site": {
    "name": "Meu Site",
    "url": "https://meusite.com.br",
    "lang": "pt-BR",
    "description": "Descricao padrao do site"
  },
  "build": {
    "minifyHTML": true,
    "minifyCSS": true,
    "minifyJS": true,
    "hashAssets": true,
    "generateSitemap": true
  },
  "partials": {
    "head": "partials/head.html",
    "header": "partials/header.html",
    "footer": "partials/footer.html"
  },
  "meta": {
    "defaultImage": "assets/imgs/og-default.jpg",
    "twitterHandle": "@handle"
  }
}
```

---

## Decisoes de Design

| Decisao | Escolha | Motivo |
|---|---|---|
| Arquitetura | Single-file + lib/ | Simplicidade maxima, facil de entender e forkar |
| Template engine | Nenhuma | Sistema de partials via comentarios HTML cobre 95% dos casos |
| Dev mode | Rebuild completo + terminal | Zero overhead, sem WebSocket, sem dependencia extra |
| Hospedagem | Cloudflare Pages | Deploy via git push, CDN global, HTTPS gratis |
| Otimizacao de imagens | sharp desde v1 | Build completo desde o inicio |
| Hash de assets | MD5 8 chars | Cache-busting simples e deterministico |

---

## Fora de Escopo (v1)

- HMR / live reload automatico no browser
- Suporte a Apache / Nginx (apenas Cloudflare Pages)
- Minificacao de SVG (SVGO)
- Markdown para blog
- Busca estatica (Pagefind)
- Painel de administracao
