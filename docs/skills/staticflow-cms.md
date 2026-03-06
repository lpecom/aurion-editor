---
name: staticflow-cms
description: Use when working with the StaticFlow CMS framework — adding pages, assets, partials, building, deploying to Cloudflare Pages, or debugging build output.
---

# StaticFlow CMS — SOP Reference

## Overview

StaticFlow is a zero-runtime static site framework. Pages are HTML files. Build output is plain HTML in `dist/`. No server, no database, no template engine.

**Core principle:** File name = URL. Build = transform. Deploy = copy `dist/`.

**Repo:** `github.com/lpecom/advfactory` (framework)
**Framework root:** `/home/lpzada/projects/advfactory`

---

## Quick Reference

| Task | Command |
|------|---------|
| Build para produção | `node bin/staticflow.js build` |
| Dev mode (watch + server) | `node bin/staticflow.js dev` |
| Limpar dist/ | `node bin/staticflow.js clean` |
| Build em projeto externo | `node bin/staticflow.js build --root /caminho/projeto` |
| Rodar testes | `node --test tests/**/*.test.js` |

---

## SOP 1 — Adicionar uma Nova Página

**1. Crie o arquivo em `pages/`**

```
pages/contato.html        → rota /contato
pages/blog/post-novo.html → rota /blog/post-novo
pages/servicos/index.html → rota /servicos
```

**Regra:** `index.html` em qualquer pasta = rota da pasta. Qualquer outro nome = subpasta com `index.html` dentro.

**2. Estrutura mínima do arquivo**

```html
<!--
  title: Título da Página
  description: Descrição para SEO e Open Graph
  image: assets/imgs/og-pagina.jpg
-->
<!DOCTYPE html>
<html lang="pt-BR">
<!-- @partial:head -->
<body>
<!-- @partial:header -->
<main>
  <h1>Conteúdo aqui</h1>
</main>
<!-- @partial:footer -->
</body>
</html>
```

**3. Rode o build**

```bash
node bin/staticflow.js build
# ou dev mode para rebuild automático:
node bin/staticflow.js dev
```

**4. Verifique em `dist/`**

```
dist/contato/index.html     ← rota /contato
dist/blog/post-novo/index.html
```

**Sem frontmatter?** O `head.html` usará os valores padrão de `config.json > site.name` e `site.description`.

---

## SOP 2 — Sistema de Partials

Partials são fragmentos HTML reutilizáveis em `partials/`. Injeção via comentário âncora:

```html
<!-- @partial:nome -->
```

**Partials padrão:**

| Arquivo | Injeta onde | Variáveis suportadas |
|---------|------------|----------------------|
| `partials/head.html` | `<!-- @partial:head -->` | `{{title}}`, `{{description}}`, `{{image}}` |
| `partials/header.html` | `<!-- @partial:header -->` | nenhuma (estático) |
| `partials/footer.html` | `<!-- @partial:footer -->` | nenhuma (estático) |

**Variáveis em `head.html`** vêm do frontmatter da página. Fallback: `config.json > site`.

**Criar um novo partial:**

1. Crie `partials/meu-partial.html` com HTML puro
2. Use `<!-- @partial:meu-partial -->` em qualquer página
3. Não é necessário registrar em nenhum lugar — o build resolve automaticamente

**Partials NÃO suportam variáveis dinâmicas** (exceto `head.html`). São HTML estático.

---

## SOP 3 — Sistema de Assets

### Como funciona

Todo arquivo em `assets/` e `css/` é processado no build:

1. Conteúdo otimizado (imagem comprimida, JS/CSS minificado)
2. Hash MD5 de 8 chars inserido no nome: `logo.png` → `logo.a3f9b2c1.png`
3. Copiado para `dist/assets/` ou `dist/css/`
4. `dist/asset-manifest.json` mapeia original → hashed
5. Todas as referências nos HTMLs são substituídas automaticamente

### Otimizações por tipo

| Tipo | Otimização |
|------|-----------|
| `.jpg` / `.jpeg` | sharp, qualidade 85, progressive |
| `.png` | sharp, compressão lossless |
| `.js` | terser (minify + mangle) |
| `.css` | clean-css (minify) |
| `.svg`, `.woff2` | cópia direta (sem alteração) |
| dotfiles (`.gitkeep`) | ignorados |

### Como referenciar assets em HTML

Use o caminho relativo ao projeto — o build substitui automaticamente:

```html
<!-- Use assim: -->
<img src="assets/imgs/foto.jpg" alt="...">
<link rel="stylesheet" href="css/global.css">

<!-- O build gera: -->
<img src="assets/imgs/foto.a3f9b2c1.jpg" alt="...">
<link rel="stylesheet" href="css/global.3cc3af93.css">
```

### Controle via config.json

```json
"build": {
  "hashAssets": true,    // false = sem hash (dev only)
  "minifyJS": true,
  "minifyCSS": true
}
```

### Adicionar um novo asset

1. Coloque o arquivo em `assets/imgs/`, `assets/fonts/`, `assets/icons/` ou `assets/js/`
2. Referencie normalmente no HTML
3. O próximo `build` processa e gera o hash

---

## SOP 4 — Frontmatter (Metadados por Página)

Bloco de comentário HTML no topo do arquivo, antes de qualquer conteúdo:

```html
<!--
  title: Título da Página
  description: Descrição curta para SEO
  image: assets/imgs/og-imagem.jpg
-->
```

**Regras:**
- Deve ser o **primeiro bloco** do arquivo (linha 1)
- Formato: `chave: valor` (uma por linha)
- Sem aspas, sem YAML especial
- Se ausente, o build usa `config.json > site` como fallback

**Campos suportados pelo `head.html` padrão:**

| Campo | Usado em |
|-------|---------|
| `title` | `<title>`, `og:title` |
| `description` | `meta description`, `og:description` |
| `image` | `og:image` |

---

## SOP 5 — Configuração (`config.json`)

```json
{
  "site": {
    "name": "Nome do Site",
    "url": "https://meusite.com.br",
    "lang": "pt-BR",
    "description": "Descrição padrão"
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

**`site.url`** é obrigatório para o `sitemap.xml` funcionar corretamente.

---

## SOP 6 — Dev Mode

```bash
node bin/staticflow.js dev
```

- Build completo inicial
- Watch em `pages/`, `partials/`, `assets/`, `css/`
- Rebuild ao detectar mudança → log no terminal
- Servidor estático em `http://localhost:3000`
- **Reload manual** — sem live reload automático no browser

---

## SOP 7 — Deploy (Cloudflare Pages)

**Setup inicial:**
1. Push do repositório para GitHub
2. Cloudflare Pages → Create project → Connect GitHub repo
3. Build command: `node bin/staticflow.js build`
4. Build output directory: `dist`
5. Root directory: deixar vazio (ou pasta do projeto se monorepo)

**Deploy contínuo:** automático a cada `git push` na branch configurada.

**`_redirects` gerado automaticamente** em `dist/_redirects`:
```
/sitemap.xml  /sitemap.xml  200
/*            /404/index.html  404
```

Cloudflare Pages já resolve `/sobre` → `dist/sobre/index.html` nativamente.

---

## SOP 8 — Estrutura do Projeto (template)

```
projeto/
├── pages/           ← Páginas HTML (fonte de verdade)
│   ├── index.html   → /
│   ├── sobre.html   → /sobre
│   └── blog/
│       └── post.html → /blog/post
├── partials/
│   ├── head.html    ← Aceita {{title}}, {{description}}, {{image}}
│   ├── header.html  ← Estático
│   └── footer.html  ← Estático
├── assets/
│   ├── imgs/
│   ├── fonts/
│   ├── icons/
│   └── js/
├── css/
│   └── global.css
├── dist/            ← Output do build (não editar, não commitar)
└── config.json
```

---

## Tabela de Roteamento Completa

| Arquivo em `pages/` | URL pública | Destino em `dist/` |
|---------------------|-------------|---------------------|
| `index.html` | `/` | `dist/index.html` |
| `sobre.html` | `/sobre` | `dist/sobre/index.html` |
| `blog/index.html` | `/blog` | `dist/blog/index.html` |
| `blog/post-1.html` | `/blog/post-1` | `dist/blog/post-1/index.html` |
| `404.html` | `/404` | `dist/404/index.html` |

---

## Erros Comuns

| Sintoma | Causa | Solução |
|---------|-------|---------|
| Partial não injetado | Arquivo não existe em `partials/` | Criar `partials/nome.html` |
| `{{title}}` aparece no HTML | Frontmatter ausente ou mal formatado | Verificar bloco `<!-- ... -->` no topo |
| Asset com caminho quebrado | Referência incorreta no HTML | Usar caminho relativo à raiz do projeto |
| Build silencioso sem output | `node build.js build` direto | Usar `node bin/staticflow.js build` |
| `config.json nao encontrado` | Rodando do diretório errado | Usar flag `--root /caminho/projeto` |
| `.gitkeep` aparece no manifesto | Versão antiga do assets.js | Atualizar para versão com filtro de dotfiles |
| `dist/` não criado | Sem `pages/` no projeto | Criar pelo menos uma página |

---

## Arquitetura do Build (referência rápida)

```
1. clean.js     → rm -rf dist/ + mkdir dist/
2. assets.js    → glob assets/**/* + css/**/* → hash + otimiza → dist/ + manifest
3. pages.js     → glob pages/**/*.html → frontmatter → partials → asset refs → minify → dist/
4. sitemap.js   → rotas geradas → dist/sitemap.xml
5. redirects.js → dist/_redirects (Cloudflare Pages)
```

**Módulos:** `lib/clean.js`, `lib/assets.js`, `lib/pages.js`, `lib/sitemap.js`, `lib/redirects.js`
**Orquestrador:** `build.js`
**CLI:** `bin/staticflow.js`
