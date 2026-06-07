'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface LineChartProps {
  labels: string[];
  datasets: { label: string; data: number[]; color: string }[];
}

export function LineChart({ labels, datasets }: LineChartProps) {
  const data = {
    labels,
    datasets: datasets.map((ds) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.color,
      backgroundColor: ds.color + '22',
      tension: 0.35,
      fill: true,
      pointRadius: 4,
    })),
  };

  const options = {
    responsive: true,
    scales: {
      y: { min: 0, max: 100, ticks: { stepSize: 20 } },
    },
    plugins: {
      legend: { position: 'bottom' as const },
    },
  };

  return <Line data={data} options={options} />;
}
