import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface RemovedItem {
  id: string;
  category: string;
  description: string;
  html_original: string;
}

interface CopierChecklistProps {
  removedItems: RemovedItem[];
  disabledItems: Set<string>; // IDs of items to restore (toggle OFF = restore)
  onToggleItem: (id: string) => void;
  checkoutReplacements: Map<string, string>; // id -> new URL
  onCheckoutReplace: (id: string, newUrl: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  tracking: 'Tracking & Analytics',
  chat: 'Chat Widgets',
  push: 'Push & Notificações',
  iframe: 'Iframes de Terceiros',
  comment: 'Comentários HTML',
  verification: 'Meta Tags de Verificação',
  service_worker: 'Service Workers',
  checkout: 'Links de Compra',
};

const CATEGORY_ORDER = ['tracking', 'chat', 'push', 'checkout', 'iframe', 'verification', 'service_worker', 'comment'];

export default function CopierChecklist({
  removedItems,
  disabledItems,
  onToggleItem,
  checkoutReplacements,
  onCheckoutReplace,
}: CopierChecklistProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Group items by category
  const grouped = new Map<string, RemovedItem[]>();
  for (const item of removedItems) {
    const list = grouped.get(item.category) || [];
    list.push(item);
    grouped.set(item.category, list);
  }

  // Sort categories
  const sortedCategories = CATEGORY_ORDER.filter(c => grouped.has(c));

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const removedCount = removedItems.length - disabledItems.size;

  return (
    <div className="space-y-3">
      <div className="text-sm text-text-muted">
        {removedCount} {removedCount === 1 ? 'item removido' : 'itens removidos'}
      </div>

      {sortedCategories.map(category => {
        const items = grouped.get(category)!;
        const isCollapsed = collapsedCategories.has(category);

        return (
          <div key={category} className="border border-border rounded-md overflow-hidden">
            <button
              onClick={() => toggleCategory(category)}
              aria-expanded={!isCollapsed}
              className="w-full flex items-center justify-between px-3 py-2 bg-surface-2 text-sm font-medium text-text cursor-pointer hover:bg-surface-2/80 transition-colors"
            >
              <span>
                {CATEGORY_LABELS[category] || category} ({items.length})
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
              />
            </button>

            {!isCollapsed && (
              <div className="divide-y divide-border">
                {items.map(item => {
                  const isRemoved = !disabledItems.has(item.id);
                  return (
                    <div key={item.id} className="px-3 py-2 space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isRemoved}
                          onChange={() => onToggleItem(item.id)}
                          className="rounded border-border text-primary focus:ring-primary/50 cursor-pointer"
                        />
                        <span className={`text-sm ${isRemoved ? 'text-text' : 'text-text-muted line-through'}`}>
                          {item.description}
                        </span>
                      </label>

                      {item.category === 'checkout' && isRemoved && (
                        <div className="ml-6">
                          <input
                            type="text"
                            placeholder="Novo link de compra (opcional)"
                            value={checkoutReplacements.get(item.id) || ''}
                            onChange={(e) => onCheckoutReplace(item.id, e.target.value)}
                            className="w-full bg-surface-2 border border-border rounded-md px-2 py-1 text-xs text-text placeholder:text-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
