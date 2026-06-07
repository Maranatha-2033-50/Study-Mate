'use client';

import type { Profile } from '@/types';

interface StudentSidebarProps {
  students: Profile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function StudentSidebar({ students, selectedId, onSelect }: StudentSidebarProps) {
  return (
    <aside className="w-64 flex-none border-r border-gray-200 bg-white overflow-y-auto">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          담당 학생 ({students.length})
        </h2>
      </div>

      <nav className="p-2">
        {students.length === 0 && (
          <p className="text-xs text-gray-400 px-3 py-4">매핑된 학생이 없습니다.</p>
        )}
        {students.map((student) => (
          <button
            key={student.id}
            onClick={() => onSelect(student.id)}
            className={`
              w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors
              ${selectedId === student.id
                ? 'bg-brand-50 text-brand-700'
                : 'text-gray-700 hover:bg-gray-50'}
            `}
          >
            {/* Avatar */}
            <span className={`
              flex-none w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
              ${selectedId === student.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}
            `}>
              {student.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-sm font-medium truncate">{student.name}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
