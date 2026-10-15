<template>
  <div class="chart-container" :class="{ 'mobile-chart': isMobile }">
    <Line :key="isMobile ? 'mobile' : 'desktop'" :data="displayData" :options="options" />
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Line } from "vue-chartjs";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
} from "chart.js";

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale);

const props = defineProps({
  chartData: { type: Object, required: true },
  isMobile: { type: Boolean, default: false },
});

const colors = ["#2563eb", "#c2410c", "#047857", "#a21caf", "#0e7490", "#be123c"];
const dashes = [[], [7, 3], [2, 3]];
const displayData = computed(() => {
  if (!props.isMobile) return props.chartData;
  return {
    ...props.chartData,
    datasets: props.chartData.datasets.map((dataset) => ({
      ...dataset,
      borderColor: colors[dataset.id % colors.length],
      backgroundColor: colors[dataset.id % colors.length],
      borderDash: dashes[dataset.id % dashes.length],
      pointStyle: ["circle", "triangle", "rectRot"][dataset.id % 3],
    })),
  };
});

const options = computed(() => {
  if (!props.isMobile) return { responsive: true };

  const values = props.chartData.datasets.flatMap((dataset) => dataset.data).filter(Number.isFinite);
  const bounds = values.length ? {
    min: Math.floor((Math.min(...values) - 2) / 2) * 2,
    max: Math.ceil((Math.max(...values) + 2) / 2) * 2,
  } : {};

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false, axis: "x" },
    elements: {
      line: { borderWidth: 2.5 },
      point: { radius: 3, hoverRadius: 6, hitRadius: 20 },
    },
    scales: {
      x: {
        ticks: { maxTicksLimit: 6, maxRotation: 0 },
        grid: { display: false },
      },
      y: {
        ...bounds,
        title: { display: true, text: "Output (dB SPL)" },
        ticks: { maxTicksLimit: 8 },
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 12 },
      },
      tooltip: {
        // Keep comparisons visible: tapping a frequency shows every visible curve.
        callbacks: {
          label(context) {
            const output = context.parsed.y;
            const outputs = context.chart.data.datasets
              .filter((_, index) => context.chart.isDatasetVisible(index))
              .map((dataset) => dataset.data[context.dataIndex])
              .filter(Number.isFinite);
            const gap = Math.max(...outputs) - output;
            return `${context.dataset.label}: ${output.toFixed(1)} dB${gap > 0.05 ? ` (−${gap.toFixed(1)} dB)` : ""}`;
          },
        },
      },
    },
  };
});
</script>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
  min-width: 0;
}

.mobile-chart {
  height: clamp(20rem, 55svh, 28rem);
}
</style>
