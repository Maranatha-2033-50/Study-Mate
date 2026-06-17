import { DomainDashboard } from '@/components/student/DomainDashboard';

export const metadata = { title: '교과 학습 | Study Mate' };

export default async function SchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  return <DomainDashboard siteType="SCHOOL" categoryParam={category} />;
}
