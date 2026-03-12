import { useState, useMemo } from 'react';
import {
  HelpCircle,
  Book,
  Globe,
  FileText,
  Copy,
  GitBranch,
  Languages,
  Settings,
  ChevronDown,
  Search,
  Rocket,
  Layers,
  MessageCircle,
  Bot,
  Shield,
  Wrench,
} from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  items: FAQItem[];
}

const sections: FAQSection[] = [
  {
    id: 'getting-started',
    title: 'Primeiros Passos',
    description: 'Comece por aqui se é novo no Aurion Editor',
    icon: <Rocket className="w-5 h-5" />,
    color: 'text-primary',
    gradient: 'from-primary/10 to-transparent',
    items: [
      {
        question: 'O que é o Aurion Editor?',
        answer:
          'O Aurion Editor é uma plataforma completa para criação, gestão e publicação de páginas de venda, advertoriais e funis de conversão. Stack: Fastify + better-sqlite3 no backend, React 19 + TypeScript + Tailwind CSS 4 no frontend, GrapesJS Studio SDK como editor visual, e Cloudflare Workers + R2 para serving das páginas em produção.',
      },
      {
        question: 'Como fazer login?',
        answer:
          'Acesse /admin/login e insira seu usuário e senha. As credenciais são definidas via variáveis de ambiente ADMIN_USER e ADMIN_PASS. Após login, uma sessão é criada na tabela sessions do SQLite com token e expiração. Se o token expirar, você será redirecionado automaticamente para a tela de login.',
      },
      {
        question: 'Qual é a estrutura do painel?',
        answer:
          'O menu lateral organiza as funcionalidades em 4 seções:\n\n• Conteúdo — Páginas de Venda, Advertoriais, Auxiliares, Copier\n• Marketing — Funis de Venda, Teste A/B, Conversion Boosters\n• Ferramentas — Recursos (Imagens, Pixels, Domínios, Scripts, Idiomas), Script Maker, Traduções, Healthcheck, Claude\n• Sistema — Integrações (Provedores de Tradução, Cloudflare), FAQ',
      },
    ],
  },
  {
    id: 'domains',
    title: 'Domínios',
    description: 'Configuração e provisionamento via Cloudflare Workers + R2',
    icon: <Globe className="w-5 h-5" />,
    color: 'text-accent',
    gradient: 'from-accent/10 to-transparent',
    items: [
      {
        question: 'Como adicionar um domínio?',
        answer:
          'Vá em Recursos > Domínios e clique em "Adicionar Domínio". Informe o domínio (ex: meusite.com), selecione a conta Cloudflare cadastrada em Sistema > Integrações > Cloudflare, informe o Zone ID da Cloudflare, e salve.',
      },
      {
        question: 'Quais permissões são necessárias no API Token da Cloudflare?',
        answer:
          'O API Token precisa das seguintes permissões:\n\n• Account > Workers Scripts > Edit (deploy do worker que serve páginas)\n• Account > Workers R2 Storage > Edit (criar bucket R2 e fazer upload de páginas)\n• Account > Account Settings > Read (validar conta)\n\nSem essas permissões, o provisionamento falhará. O token é configurado por conta Cloudflare em Sistema > Integrações > Cloudflare.',
      },
      {
        question: 'Como obter o API Token da Cloudflare?',
        answer:
          'Passo a passo:\n1. Acesse dash.cloudflare.com → Perfil → API Tokens\n2. Clique em "Create Token" → "Create Custom Token"\n3. Adicione as permissões: Account - Workers Scripts - Edit, Account - Workers R2 Storage - Edit, Account - Account Settings - Read\n4. Em "Account Resources", selecione sua conta\n5. Clique em "Continue to Summary" → "Create Token"\n6. Copie o token (exibido apenas uma vez!)\n7. Cole em Sistema > Integrações > Cloudflare > Account ID + API Token',
      },
      {
        question: 'Como obter o Zone ID e Account ID?',
        answer:
          'Account ID: Acesse dash.cloudflare.com → qualquer domínio → na barra lateral direita, em "API", copie o "Account ID".\n\nZone ID: Acesse dash.cloudflare.com → selecione o domínio → na barra lateral direita, em "API", copie o "Zone ID". Cada domínio tem um Zone ID diferente.',
      },
      {
        question: 'O que é provisionamento e como funciona?',
        answer:
          'Provisionamento é o setup automático da infraestrutura Cloudflare para servir suas páginas. Ao clicar em "Provisionar", o sistema:\n\n1. Cria um bucket R2 chamado {domínio}-pages para armazenar os arquivos HTML\n2. Faz deploy de um Cloudflare Worker chamado {domínio}-worker com binding ao R2\n3. Configura o custom domain no Worker para receber tráfego\n\nO Worker serve as páginas do R2, gerencia sessões de funil (cookies com TTL de 30 dias), aplica regras de cloaker, e faz rewrite de links internos.',
      },
      {
        question: 'Troubleshooting: provisionamento falhou',
        answer:
          'Verifique:\n1. API Token tem TODAS as permissões listadas acima\n2. Account ID está correto (32 caracteres hex)\n3. Zone ID corresponde ao domínio correto\n4. O domínio está com status "Active" no Cloudflare\n5. Nameservers do domínio apontam para o Cloudflare\n6. Não há Worker com nome conflitante na conta\n7. Use o botão "Testar Conexão" em Integrações > Cloudflare para validar credenciais\n8. Acesse Healthcheck para diagnósticos detalhados',
      },
    ],
  },
  {
    id: 'pages',
    title: 'Páginas',
    description: 'Criação e publicação de páginas de venda e advertoriais',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-info',
    gradient: 'from-info/10 to-transparent',
    items: [
      {
        question: 'Quais são os tipos de página?',
        answer:
          'Existem três tipos:\n\n• PV (Página de Venda) — Página principal do produto com oferta e CTA de compra. Pode ter páginas auxiliares filhas e ser publicada em múltiplos domínios.\n\n• Advertorial — Página estilo artigo/notícia que pré-vende o produto. Usada como pré-lander em campanhas de tráfego. Pode ter páginas auxiliares filhas.\n\n• Auxiliar — Páginas complementares (termos de uso, política de privacidade, rastreio, contato). Devem ter um "pai" (PV ou Advertorial). Não são publicadas independentemente — são publicadas junto ao domínio do pai.',
      },
      {
        question: 'Como funciona a publicação?',
        answer:
          'Ao publicar uma página, o sistema:\n1. Injeta os pixels de rastreamento (Facebook, Google, TikTok) configurados na categoria\n2. Injeta scripts globais ativos (head, body_start, body_end)\n3. Faz upload do HTML final para o bucket R2 de cada domínio associado\n4. O Worker do Cloudflare passa a servir a página no slug configurado\n5. Cache de 1 hora é aplicado automaticamente\n\nPara despublicar, o arquivo é removido do R2 e o status volta para "draft".',
      },
      {
        question: 'Como funciona o Editor Visual?',
        answer:
          'O editor usa GrapesJS Studio SDK — um editor WYSIWYG drag-and-drop. Você pode: clicar em textos para editar inline; arrastar blocos do painel lateral (imagens, vídeos, botões, formulários); usar o Style Manager para alterar CSS visual (cores, fontes, espaçamentos, bordas); visualizar em desktop/tablet/mobile; e editar o HTML/CSS diretamente no painel de código.',
      },
      {
        question: 'O que são Categorias?',
        answer:
          'Categorias agrupam páginas com configurações compartilhadas. Uma categoria define: quais pixels de rastreamento injetar, quais domínios publicar, e configurações herdadas por todas as páginas da categoria. Tipos de categoria: pv, advertorial, auxiliar. Ao publicar, a página herda automaticamente pixels e domínios da categoria.',
      },
      {
        question: 'Como funciona Teste A/B?',
        answer:
          'Você pode duplicar uma página como variante A/B. A página duplicada recebe um variant_label (A, B, C...) e compartilha o mesmo variant_group com a original. Através dos funis de venda, você pode direcionar tráfego para variantes diferentes e comparar performance.',
      },
    ],
  },
  {
    id: 'copier',
    title: 'Copier (Clonador)',
    description: 'Clone qualquer página da web em segundos',
    icon: <Copy className="w-5 h-5" />,
    color: 'text-warning',
    gradient: 'from-warning/10 to-transparent',
    items: [
      {
        question: 'Como clonar uma página externa?',
        answer:
          'Acesse "Copier" no menu. Cole a URL e clique em "Clonar". O sistema usa Puppeteer (navegador headless) para renderizar a página completa incluindo JavaScript. Se Puppeteer falhar, faz fallback para fetch direto. Após o scraping, você verá o preview com a checklist de itens removidos à direita.',
      },
      {
        question: 'O que é removido automaticamente?',
        answer:
          'O Copier remove/processa automaticamente:\n• Scripts de analytics (Google Analytics, Facebook Pixel, etc.)\n• Chatbots e widgets de terceiros\n• Meta tags de verificação de propriedade\n• Service workers do site original\n• Iframes externos\n\nTodos os itens removidos aparecem na checklist lateral. Você pode reativar qualquer item desmarcando o checkbox.',
      },
      {
        question: 'Como substituir links de checkout?',
        answer:
          'Na tela de preview após a clonagem, a checklist lateral mostra todos os links de checkout detectados. Cada um tem um campo de input onde você pode digitar a nova URL. O sistema usa data-copier-id para substituir apenas o link específico, sem afetar outros elementos. Links com href="#" são os que foram detectados e neutralizados.',
      },
      {
        question: 'O que acontece com as imagens e assets?',
        answer:
          'Todas as imagens, CSS e fontes são baixadas automaticamente e armazenadas localmente em /assets/. As URLs no HTML são convertidas para caminhos relativos. Isso garante que a página funcione mesmo offline e não dependa do servidor original.',
      },
    ],
  },
  {
    id: 'funnels',
    title: 'Funis de Venda',
    description: 'Construa fluxos de conversão com editor visual React Flow',
    icon: <GitBranch className="w-5 h-5" />,
    color: 'text-primary',
    gradient: 'from-primary/10 to-transparent',
    items: [
      {
        question: 'Como criar um funil?',
        answer:
          'Acesse "Funis de Venda" e clique em "Novo Funil". Dê um nome e acesse o editor visual. Arraste nós da paleta lateral para o canvas: Entrada (verde), Página (azul) e Redirect (violeta). Conecte os nós arrastando das alças (handles) de saída para entrada.',
      },
      {
        question: 'Quais são os tipos de nó?',
        answer:
          '• Entrada (verde) — Ponto de início do funil. Define o entry_slug que ativa o funil na URL. Um funil deve ter exatamente 1 nó de entrada. Pode ter um domínio de entrada específico.\n\n• Página (azul) — Renderiza uma página publicada do Aurion. Selecione a página no painel de propriedades. O CTA Selector (opcional) define qual elemento CSS terá o link reescrito para o próximo nó.\n\n• Redirect (violeta) — Redireciona para URL externa (checkout, upsell). Suporta 301 (permanente) ou 302 (temporário).',
      },
      {
        question: 'Como funciona a ativação do funil?',
        answer:
          'Ao ativar, o sistema valida o grafo:\n• Exatamente 1 nó de entrada\n• Todos os slugs de página existem no banco\n• Sem nós órfãos (todos conectados)\n• Sem ciclos no grafo\n• entry_slug não conflita com páginas publicadas ou outros funis ativos\n\nSe válido, compila o funil em JSON e faz upload para o R2 em _funnels/{entry_slug}.json. O Worker do Cloudflare lê esse JSON para orquestrar a navegação do visitante.',
      },
      {
        question: 'Atalhos de teclado do editor',
        answer:
          '• Cmd/Ctrl + S — Salvar funil\n• Delete ou Backspace — Remover nó/conexão selecionada\n• Escape — Desselecionar nó\n• Scroll — Zoom in/out no canvas\n• Clique + arraste no canvas — Mover visualização\n• Snap to grid — Alinhamento automático em grade de 20px',
      },
      {
        question: 'Como o funil rastreia sessões?',
        answer:
          'O Worker do Cloudflare usa cookies para rastrear a sessão do visitante no funil. Quando um visitante acessa o entry_slug, um cookie de sessão é criado com TTL de 30 dias. A cada navegação dentro do funil, o Worker sabe qual é o próximo nó baseado no grafo JSON e reescreve os links internos automaticamente.',
      },
    ],
  },
  {
    id: 'resources',
    title: 'Recursos',
    description: 'Imagens, scripts, pixels e idiomas',
    icon: <Layers className="w-5 h-5" />,
    color: 'text-accent',
    gradient: 'from-accent/10 to-transparent',
    items: [
      {
        question: 'Como gerenciar imagens?',
        answer:
          'Recursos > Imagens. Upload por drag-and-drop ou seleção. Formatos aceitos: JPEG, PNG, WebP, GIF, SVG. As imagens são otimizadas automaticamente via Sharp (redimensionamento, thumbnails). Armazenadas em /dist/assets/images/. A navegação estilo Finder permite filtrar por página/projeto.',
      },
      {
        question: 'Como funcionam os Scripts Globais?',
        answer:
          'Recursos > Scripts. Cada script tem:\n• Nome — identificador\n• Posição — head (antes do </head>), body_start (após <body>), body_end (antes de </body>)\n• Código — JavaScript puro\n• Ativo — toggle on/off\n\nScripts ativos são injetados em TODAS as páginas no momento da publicação.',
      },
      {
        question: 'Como funcionam os Pixels de Rastreamento?',
        answer:
          'Recursos > Pixels. Plataformas suportadas:\n• Facebook — gera fbq("init", pixel_id) automaticamente\n• Google — gera gtag GA4 setup automaticamente\n• TikTok — gera ttq pixel initialization\n• Custom — código livre\n\nPixels são associados via category_config. Todas as páginas de uma categoria herdam os pixels configurados. São injetados no HTML durante a publicação.',
      },
      {
        question: 'Como gerenciar idiomas?',
        answer:
          'Recursos > Idiomas. Configure os idiomas disponíveis com código ISO (pt-BR, en-US, es-ES), nome e bandeira. Os idiomas configurados ficam disponíveis na hora de traduzir páginas. Cada página tem um campo lang que indica seu idioma.',
      },
    ],
  },
  {
    id: 'script-maker',
    title: 'Script Maker',
    description: 'Gerador de scripts sem código — cloaker, anti-copy, back-block',
    icon: <Wrench className="w-5 h-5" />,
    color: 'text-warning',
    gradient: 'from-warning/10 to-transparent',
    items: [
      {
        question: 'O que é o Script Maker?',
        answer:
          'Gerador interativo de 4 tipos de script, sem necessidade de programação. Basta configurar as opções e o código é gerado automaticamente para colar nas suas páginas.',
      },
      {
        question: 'Como funciona o Cloaker?',
        answer:
          'Filtra visitantes por:\n• Países — lista de códigos ISO (allow/block mode)\n• Dispositivos — desktop, mobile, tablet (allow/block)\n• Navegadores — Chrome, Firefox, Safari, Edge (allow/block)\n• Referrer Whitelist — só permite tráfego de domínios específicos\n\nAções quando bloqueado: redirecionar para URL, mostrar "safe page", ou retornar 403.\n\nAs regras de cloaker também podem ser configuradas por página em nível de Worker (mais seguro, pois filtra antes de servir o HTML).',
      },
      {
        question: 'O que faz o Anti-Copy?',
        answer:
          'Desabilita: clique direito (context menu), seleção de texto, arrastar imagens, atalhos de cópia (Ctrl+C, Cmd+C), e acesso ao Inspect Element. Protege o conteúdo da página contra cópia fácil.',
      },
      {
        question: 'O que faz o Back-Block?',
        answer:
          'Impede o botão "Voltar" do navegador. Manipula o history.state para que o visitante permaneça na página atual ao clicar em voltar. Útil para manter o visitante no funil de vendas.',
      },
      {
        question: 'O que faz o Bloqueador de DevTools?',
        answer:
          'Bloqueia F12, Ctrl+Shift+I, Ctrl+Shift+J (console). Detecta tentativas de abrir o DevTools e opcionalmente redireciona o visitante para outra URL. Dificulta a inspeção do código-fonte.',
      },
    ],
  },
  {
    id: 'translations',
    title: 'Traduções',
    description: 'Traduza páginas para múltiplos idiomas via Google ou OpenAI',
    icon: <Languages className="w-5 h-5" />,
    color: 'text-info',
    gradient: 'from-info/10 to-transparent',
    items: [
      {
        question: 'Provedores de tradução suportados',
        answer:
          'Dois provedores disponíveis:\n\n• Google Translate — API gratuita, boa para traduções rápidas\n• OpenAI — usa modelos GPT, melhor qualidade para copy de marketing (requer API key da OpenAI, permite escolher o modelo)\n\nConfigure em Sistema > Integrações > Provedores de Tradução com a API key do serviço.',
      },
      {
        question: 'Como traduzir uma página?',
        answer:
          'Na página original, clique em "Traduzir". Selecione o idioma de destino e o provedor. O sistema cria uma NOVA página com:\n• source_page_id linkando à original\n• Slug: {slug-original}-{código-idioma}\n• Status: draft (para revisão manual)\n• Herda category_config e pixels da original\n\nO conteúdo textual é traduzido mantendo toda a estrutura HTML e estilos.',
      },
    ],
  },
  {
    id: 'claude',
    title: 'Integração Claude (MCP)',
    description: 'Use IA para gerenciar o Aurion via Claude Code ou Claude Desktop',
    icon: <Bot className="w-5 h-5" />,
    color: 'text-primary',
    gradient: 'from-primary/10 to-transparent',
    items: [
      {
        question: 'O que é a integração MCP?',
        answer:
          'O Aurion expõe um servidor MCP (Model Context Protocol) com 30+ ferramentas que permitem ao Claude Code ou Claude Desktop gerenciar todo o sistema: criar/editar/publicar páginas, gerenciar funis, scripts, pixels, imagens, domínios, traduções — tudo via linguagem natural.',
      },
      {
        question: 'Como gerar uma API Key?',
        answer:
          'Acesse "Claude" no menu. Clique em "Gerar Nova Chave" e dê um apelido. A chave (formato aur_..., 64 caracteres hex) é exibida APENAS UMA VEZ — copie e salve imediatamente. Cada chave é independente e pode ser revogada individualmente.',
      },
      {
        question: 'Como configurar no Claude Code CLI?',
        answer:
          'Adicione ao ~/.claude/settings.json:\n\n{\n  "mcpServers": {\n    "aurion-editor": {\n      "url": "https://seu-dominio.com/api/mcp",\n      "auth": {\n        "type": "header",\n        "headerKey": "Authorization",\n        "headerValue": "Bearer aur_sua_chave_aqui"\n      }\n    }\n  }\n}\n\nReinicie o Claude Code e as ferramentas do Aurion estarão disponíveis.',
      },
      {
        question: 'Quais ferramentas MCP estão disponíveis?',
        answer:
          'Páginas: list_pages, get_page, create_page, edit_page, publish_page, unpublish_page, delete_page, duplicate_page, clone_page\nAuxiliares: list_auxiliares, create_auxiliar, edit_auxiliar, delete_auxiliar\nFunis: list_funnels, get_funnel, create_funnel, edit_funnel, activate_funnel, deactivate_funnel, delete_funnel, duplicate_funnel\nRecursos: list_scripts, create_script, edit_script, delete_script, list_pixels, list_images, upload_image, list_domains\nOutros: list_translation_providers, list_languages, get_activity_log',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Configurações & Deploy',
    description: 'Variáveis de ambiente, banco de dados e deploy na Railway',
    icon: <Settings className="w-5 h-5" />,
    color: 'text-text-muted',
    gradient: 'from-surface-2 to-transparent',
    items: [
      {
        question: 'Quais variáveis de ambiente são necessárias?',
        answer:
          'Variáveis obrigatórias (.env):\n• ADMIN_USER — Nome de usuário de login (ex: admin)\n• ADMIN_PASS — Senha de login (MUDE em produção!)\n• SESSION_SECRET — Chave secreta para criptografia de sessão\n• PORT — Porta do servidor (padrão: 3001)\n• NODE_ENV — "production" ou "development"\n\nOpcional:\n• ADMIN_HOST — Domínio customizado do admin (ex: admin.meusite.com)\n\nA Cloudflare é configurada via interface (Sistema > Integrações), não via env vars.',
      },
      {
        question: 'Qual banco de dados é usado?',
        answer:
          'SQLite via better-sqlite3 — banco de dados embutido, sem necessidade de servidor externo. O arquivo do banco fica em server/db/database.sqlite. O schema é inicializado automaticamente na primeira execução. Tabelas: pages, categories, domains, cloudflare_accounts, pixels, scripts, images, languages, translation_providers, sessions, api_keys, activity_log, funnels, e tabelas de relacionamento (page_domains, category_domains, page_parents, funnel_domains, page_cloaker_rules).',
      },
      {
        question: 'Como fazer deploy na Railway?',
        answer:
          'O projeto já tem railway.json configurado:\n\n1. Conecte o repositório GitHub ao Railway\n2. Configure as variáveis de ambiente (ADMIN_USER, ADMIN_PASS, SESSION_SECRET, NODE_ENV=production)\n3. O Railway usa NIXPACKS para build: instala deps → build React (Vite) → build site\n4. Start command: node server/server.js\n5. Health check automático em /api/health\n6. Restart automático em falha (max 10 retries)\n7. Configure um domínio customizado no Railway se necessário',
      },
      {
        question: 'Como funciona o healthcheck?',
        answer:
          'Dois níveis de healthcheck:\n\n1. Endpoint /api/health — Retorna {status: "ok", timestamp}. Usado pelo Railway para verificar se o servidor está rodando.\n\n2. Página Healthcheck — Verifica cada domínio individualmente: tenta HTTPS primeiro (fallback HTTP), mede tempo de resposta, classifica como online (<3s), slow (≥3s), ou offline (erro/timeout 10s). Acesse pelo menu para diagnósticos.',
      },
    ],
  },
  {
    id: 'cloaker',
    title: 'Cloaker & Segurança',
    description: 'Regras de filtragem por página no Cloudflare Worker',
    icon: <Shield className="w-5 h-5" />,
    color: 'text-accent',
    gradient: 'from-accent/10 to-transparent',
    items: [
      {
        question: 'Como funciona o cloaker por página?',
        answer:
          'Além do Script Maker (client-side), cada página pode ter regras de cloaker no Worker (server-side). As regras são compiladas para JSON e armazenadas no R2 em _cloaker/{slug}.json. O Worker avalia ANTES de servir o HTML — muito mais seguro que JavaScript client-side.',
      },
      {
        question: 'Quais filtros estão disponíveis?',
        answer:
          '• Países — Usa o header CF-IPCountry do Cloudflare (preciso, geolocalização por IP). Modo allow (só permite) ou block (bloqueia).\n• Dispositivos — desktop, mobile, tablet (detecção via User-Agent)\n• Navegadores — Chrome, Firefox, Safari, Edge\n• URL Whitelist — Só permite tráfego vindo de domínios específicos (verifica Referer header)',
      },
      {
        question: 'Quais ações o cloaker pode tomar?',
        answer:
          '• Redirect — Redireciona para uma URL externa (ex: google.com)\n• Safe Page — Mostra outra página publicada no Aurion (ex: página genérica/inofensiva)\n\nA ação é executada no nível do Worker, antes de qualquer conteúdo ser enviado ao navegador.',
      },
    ],
  },
  {
    id: 'general-faq',
    title: 'FAQ Geral',
    description: 'Perguntas frequentes e troubleshooting',
    icon: <MessageCircle className="w-5 h-5" />,
    color: 'text-primary',
    gradient: 'from-primary/10 to-transparent',
    items: [
      {
        question: 'Quantas páginas posso criar?',
        answer:
          'Sem limite. SQLite suporta centenas de milhares de registros sem degradação. O gargalo prático é o armazenamento no R2 (Cloudflare tem generoso free tier: 10GB grátis).',
      },
      {
        question: 'O que acontece na republicação?',
        answer:
          'Quando o servidor reinicia (deploy, crash recovery), ele republica automaticamente todas as páginas com status "published" para os buckets R2 dos domínios associados. Isso garante que o estado do R2 sempre reflete o banco de dados.',
      },
      {
        question: 'Como funciona o sistema de Conversion Boosters?',
        answer:
          'Ferramentas de otimização de conversão acessíveis pelo menu Marketing. Inclui widgets e scripts para urgência, prova social, countdown timers e outros elementos que aumentam a taxa de conversão das suas páginas.',
      },
      {
        question: 'Posso usar múltiplas contas Cloudflare?',
        answer:
          'Sim! Em Sistema > Integrações > Cloudflare você pode adicionar quantas contas quiser. Cada conta tem seu próprio Account ID e API Token. Cada domínio é associado a uma conta específica no momento do cadastro.',
      },
      {
        question: 'Onde ficam armazenados os dados?',
        answer:
          'Tudo fica em 3 lugares:\n• SQLite (server/db/database.sqlite) — Metadados, configurações, HTML das páginas\n• Sistema de arquivos local (/dist/assets/) — Imagens uploadadas\n• Cloudflare R2 — Páginas publicadas, JSONs de funis e cloaker (apenas conteúdo em produção)',
      },
      {
        question: 'O que fazer se uma página não carrega?',
        answer:
          'Checklist:\n1. Página publicada? (status "published" no painel)\n2. Domínio provisionado? (status "active" em Recursos > Domínios)\n3. Worker respondendo? (Healthcheck)\n4. SSL correto? (Full Strict no Cloudflare)\n5. Cache desatualizado? (Purge cache no Cloudflare)\n6. Regra de cloaker bloqueando? (Verifique as regras da página)\n7. DNS apontando para Cloudflare? (Nameservers corretos)',
      },
    ],
  },
];

function AccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border/30 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer transition-colors duration-200 hover:bg-surface-2/50 group"
        aria-expanded={isOpen}
      >
        <HelpCircle className="w-4 h-4 text-text-muted shrink-0 group-hover:text-primary transition-colors duration-200" />
        <span className="text-sm font-medium text-text flex-1">{item.question}</span>
        <ChevronDown
          className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-300 ${
            isOpen ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-4 pl-12">
            <p className="text-sm text-text-muted leading-relaxed whitespace-pre-line">{item.answer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  openItems,
  toggleItem,
  isExpanded,
  onToggleSection,
}: {
  section: FAQSection;
  openItems: Set<string>;
  toggleItem: (key: string) => void;
  isExpanded: boolean;
  onToggleSection: () => void;
}) {
  return (
    <div className="bg-surface border border-border/50 rounded-2xl overflow-hidden card-hover relative">
      <div className={`absolute inset-0 bg-gradient-to-br ${section.gradient} pointer-events-none`} />
      <button
        onClick={onToggleSection}
        className="relative w-full flex items-center gap-4 p-5 cursor-pointer hover:bg-surface-2/30 transition-colors duration-200 text-left"
        aria-expanded={isExpanded}
      >
        <div
          className={`w-11 h-11 rounded-xl bg-surface-2/80 flex items-center justify-center ${section.color} shrink-0`}
        >
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-text">{section.title}</h2>
          <p className="text-xs text-text-muted mt-0.5">{section.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 border border-border text-text-muted">
            {section.items.length}
          </span>
          <ChevronDown
            className={`w-5 h-5 text-text-muted transition-transform duration-300 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>
      <div
        className={`relative grid transition-all duration-300 ease-in-out ${
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/30">
            {section.items.map((item, idx) => {
              const key = `${section.id}-${idx}`;
              return (
                <AccordionItem
                  key={key}
                  item={item}
                  isOpen={openItems.has(key)}
                  onToggle={() => toggleItem(key)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FAQ() {
  const [search, setSearch] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const normalizeStr = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;

    const term = normalizeStr(search);

    return sections
      .map((section) => {
        const matchingItems = section.items.filter(
          (item) =>
            normalizeStr(item.question).includes(term) ||
            normalizeStr(item.answer).includes(term)
        );

        const sectionMatch =
          normalizeStr(section.title).includes(term) ||
          normalizeStr(section.description).includes(term);

        if (sectionMatch && matchingItems.length === 0) {
          return section;
        }

        if (matchingItems.length > 0) {
          return { ...section, items: matchingItems };
        }

        return null;
      })
      .filter(Boolean) as FAQSection[];
  }, [search]);

  // When searching, auto-expand all sections and matching items
  const effectiveSections = search.trim() ? new Set(filteredSections.map((s) => s.id)) : expandedSections;
  const effectiveOpenItems = useMemo(() => {
    if (!search.trim()) return openItems;
    const keys = new Set<string>();
    filteredSections.forEach((section) => {
      section.items.forEach((_, idx) => {
        keys.add(`${section.id}-${idx}`);
      });
    });
    return keys;
  }, [search, filteredSections, openItems]);

  const totalQuestions = sections.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Book className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">FAQ & Guia de Onboarding</h1>
            <p className="text-sm text-text-muted">
              {totalQuestions} perguntas organizadas em {sections.length} seções
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar perguntas, tópicos ou palavras-chave..."
          className="w-full bg-surface border border-border/50 rounded-xl pl-12 pr-4 py-3 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text cursor-pointer transition-colors"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Results info when searching */}
      {search.trim() && (
        <div className="mb-4">
          <p className="text-sm text-text-muted">
            {filteredSections.length === 0 ? (
              'Nenhum resultado encontrado.'
            ) : (
              <>
                {filteredSections.reduce((acc, s) => acc + s.items.length, 0)} resultado(s) em{' '}
                {filteredSections.length} seção(ões)
              </>
            )}
          </p>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {filteredSections.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            openItems={effectiveOpenItems}
            toggleItem={toggleItem}
            isExpanded={effectiveSections.has(section.id)}
            onToggleSection={() => toggleSection(section.id)}
          />
        ))}
      </div>

      {/* Empty state */}
      {search.trim() && filteredSections.length === 0 && (
        <div className="bg-surface border border-border/50 rounded-2xl p-10 text-center mt-4">
          <HelpCircle className="w-10 h-10 text-text-muted/40 mx-auto mb-3" />
          <p className="text-text-muted font-medium">Nenhuma pergunta encontrada</p>
          <p className="text-text-muted/60 text-sm mt-1">
            Tente buscar por outros termos ou navegue pelas seções.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 mb-4 text-center">
        <p className="text-xs text-text-subtle">
          Não encontrou o que procura? Entre em contato com o administrador do sistema.
        </p>
      </div>
    </div>
  );
}
