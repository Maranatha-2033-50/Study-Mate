import { DomainDashboard } from '@/components/student/DomainDashboard';

export const metadata = { title: '자격증 학습 | Study Mate' };

export default async function CertPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  return <DomainDashboard siteType="CERT" categoryParam={category} />;
}
