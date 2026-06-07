'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { StudentSidebar } from '@/components/tutor/StudentSidebar';
import { StudentReport } from '@/components/tutor/StudentReport';
import type { Profile } from '@/types';

export default function TutorDashboardPage() {
  const supabase = createClient();

  const [students,   setStudents]   = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      const { data: mappings } = await supabase
        .from('tutor_students')
        .select('student_id')
        .eq('tutor_id', user.id);

      if (!mappings || mappings.length === 0) { setLoading(false); return; }

      const studentIds = mappings.map((m: { student_id: string }) => m.student_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', studentIds)
        .order('name');

      if (mounted) {
        setStudents(profiles ?? []);
        if (profiles && profiles.length > 0) setSelectedId(profiles[0].id);
        setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedStudent = students.find((s) => s.id === selectedId) ?? null;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">불러오는 중…</div>;
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <p className="text-lg font-medium">매핑된 학생이 없습니다</p>
        <p className="text-sm">Supabase 대시보드 → Table Editor → tutor_students에서 학생을 추가하세요.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <StudentSidebar students={students} selectedId={selectedId} onSelect={setSelectedId} />
      <div className="flex-1 overflow-y-auto">
        {selectedStudent
          ? <StudentReport student={selectedStudent} />
          : <div className="flex items-center justify-center h-full text-gray-400">왼쪽에서 학생을 선택하세요.</div>}
      </div>
    </div>
  );
}
