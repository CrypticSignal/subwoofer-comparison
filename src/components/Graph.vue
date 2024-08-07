<template>
  <Line :data="props.chartData" />
</template>

<script setup>
import { defineProps, onMounted, watch } from "vue";
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
  chartData: {
    type: Object,
    required: true,
  },
});

watch(
  () => props.chartData,
  (newVal) => {
    console.log("chartData changed:", newVal);
  },
  { deep: true }
);

onMounted(() => {
  console.log("Initial chartData:", props.chartData);
});
</script>
