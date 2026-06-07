import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI 학습 플랫폼',
  description: 'AI 기반 취약점 분석 및 맞춤형 훈련 플랫폼',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
