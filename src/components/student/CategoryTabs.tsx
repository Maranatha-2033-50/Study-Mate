'use client';

import type { LearningCategory } from '@/types';

const TYPE_BADGE: Record<string, string> = {
  CERT:   'bg-purple-100 text-purple-700',
  LANG:   'bg-green-100  text-green-700',
  SCHOOL: 'bg-orange-100 text-orange-700',
};

interface CategoryTabsProps {
  categories: LearningCategory[];
  activeId: string;
  onChange: (id: string) => void;
}

export function CategoryTabs({ categories, activeId, onChange }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
            transition-all border
            ${activeId === cat.id
              ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
              : 'bg-white text-gray-700 border-gray-200 hover:border-brand-400'}
          `}
        >
          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${TYPE_BADGE[cat.type]}`}>
            {cat.type}
          </span>
          {cat.title}
        </button>
      ))}
    </div>
  );
}
