import { DomainDashboard } from '@/components/student/DomainDashboard';

export const metadata = { title: '어학 학습 | Study Mate' };

export default async function LangPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  return <DomainDashboard siteType="LANG" categoryParam={category} />;
}
