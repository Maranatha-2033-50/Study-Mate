'use client';

import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface RadarChartProps {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
}

export function RadarChart({ labels, datasets }: RadarChartProps) {
  const data = {
    labels,
    datasets: datasets.map((ds) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: ds.color + '33',
      borderColor: ds.color,
      borderWidth: 2,
      pointBackgroundColor: ds.color,
      pointRadius: 3,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { stepSize: 20, font: { size: 10 } },
        pointLabels: { font: { size: 11 } },
        grid: { color: '#e5e7eb' },
      },
    },
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 11 } } },
    },
  };

  return <Radar data={data} options={options} />;
}
