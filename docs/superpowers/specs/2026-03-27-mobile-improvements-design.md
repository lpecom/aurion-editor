# Aurion Editor - Mobile Improvements

**Date:** 2026-03-27
**Approach:** Responsive progressivo (adaptar componentes existentes com breakpoints Tailwind)
**Breakpoint principal:** `md` (768px)

---

## Scope

### Included
- Dashboard (stats, overview)
- Pages list (com publish/unpublish)
- Pixels management
- Scripts management
- Login (already responsive)

### Blocked on mobile
- GrapesJS visual editor
- Funnel editor (XYFlow)

---

## 1. Navigation: Sidebar to Drawer

**Current state:** Sidebar fixa 260px (collapsed 64px), sempre visivel.

**Mobile (< md):**
- Sidebar escondida por padrao
- Header fixo no topo: hamburger (esquerda), logo/titulo (centro), avatar/user (direita)
- Hamburger abre sidebar como drawer (slide-in esquerda + overlay escuro)
- Fechar: clicar no overlay ou clicar num item do menu
- Itens que levam a editor/funnel ficam desabilitados com visual de "disabled" e tooltip "Disponivel no desktop"

**Desktop (>= md):**
- Sem mudancas. Sidebar continua como esta.

**Files affected:**
- `admin/src/layouts/AdminLayout.tsx` - adicionar header mobile, logica de drawer
- `admin/src/components/Sidebar.tsx` - aceitar prop de visibilidade, callback de fechar

---

## 2. Tables to Cards

**Current state:** `<table>` full-width sem layout alternativo mobile.

**Mobile (< md):** Tabelas viram cards empilhados verticalmente.

### Card content por entidade:

**Pages card:**
- Nome da page
- Status badge (published/draft)
- Dominio
- Botoes: publish/unpublish
- Menu "..." para acoes destrutivas (deletar, duplicar)

**Scripts card:**
- Nome do script
- Tipo
- Status ativo/inativo
- Toggle on/off

**Pixels card:**
- Nome do pixel
- Plataforma (Facebook, Google, etc.)
- ID do pixel
- Toggle on/off

### Shared behavior:
- Filtros e busca empilhados full-width acima dos cards
- Acoes destrutivas sempre dentro do menu "...", nunca expostas
- Desktop: tabelas continuam iguais

**Files affected:**
- `admin/src/components/PagesList.tsx` - render condicional table vs cards
- Componentes de listagem de scripts e pixels (mesma abordagem)

---

## 3. Dashboard and General Pages

- Stats cards: garantir `grid-cols-1` ou `grid-cols-2` no mobile (< sm)
- Padding geral: `p-6` -> `p-4` no mobile
- Modais: full-screen no mobile (em vez de centrado com max-width)
- Login: sem mudancas (ja responsivo)

**Files affected:**
- `admin/src/layouts/AdminLayout.tsx` - padding responsivo
- `admin/src/components/ui/Modal.tsx` - fullscreen mobile variant

---

## 4. Desktop-Only Screen Blocking

- GrapesJS editor e Funnel editor: no mobile, renderiza placeholder
- Placeholder: icone de desktop + mensagem "Use um computador para editar paginas" + botao voltar
- Rotas continuam existindo, so o conteudo muda

**Files affected:**
- `admin/src/editor/EditorPage.tsx` - wrapper com check de viewport
- Componente do funnel editor - mesmo wrapper
- Novo componente: `DesktopOnlyPlaceholder.tsx` (reutilizavel)

---

## Technical Notes

- **Framework:** Tailwind v4 breakpoints (`md:`, `sm:`, `lg:`)
- **No new dependencies** - tudo com Tailwind + React state
- **Drawer state:** useState no AdminLayout, controlado pelo hamburger
- **Viewport detection para bloqueio:** media query via `window.matchMedia` ou classe Tailwind com hidden/block
- **Zero impacto no desktop** - todas as mudancas sao aditivas via breakpoints
