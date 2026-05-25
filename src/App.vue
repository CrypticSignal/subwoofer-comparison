<script setup>
import { computed, onMounted, ref } from "vue";
import Graph from "./components/Graph.vue";
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";

const subwoofersSelected = ref([]);
const selectedSubwooferIDs = ref([]); // store ids in an array for reliable reactivity
const unfilteredSubs = ref([]);
const filterBrandText = ref("");
const filterModelText = ref("");
const filterType = ref("all");
const sortBy = ref("brand");
const sortDirection = ref("asc");
const isMobile = ref(false);
const loading = ref(true);

const chartData = ref({
  labels: ["10Hz", "12.5Hz", "15Hz", "20Hz", "25Hz", "31.5Hz", "40Hz", "50Hz", "63Hz", "80Hz", "100Hz", "125Hz"],
  datasets: [],
});

const columnDefinitions = [
  { name: "Brand", index: 0 },
  { name: "Model", index: 1 },
  { name: "Drivers", index: 2 },
  { name: "Driver Size", index: 3 },
  { name: "Type", index: 4 },
  { name: "Source", index: 5 },
  { name: "Mode", index: 6 },
  { name: "10Hz", index: 7 },
  { name: "12.5Hz", index: 8 },
  { name: "15Hz", index: 9 },
  { name: "20Hz", index: 10 },
  { name: "25Hz", index: 11 },
  { name: "31.5Hz", index: 12 },
  { name: "40Hz", index: 13 },
  { name: "50Hz", index: 14 },
  { name: "63Hz", index: 15 },
  { name: "80Hz", index: 16 },
  { name: "100Hz", index: 17 },
  { name: "125Hz", index: 18 },
];

const columns = columnDefinitions.map((column) => column.name);
const columnsSubSelected = ["Model", "Source", "Mode", "10Hz", "12.5Hz", "15Hz", "20Hz", "25Hz", "31.5Hz", "40Hz", "50Hz", "63Hz", "80Hz", "100Hz", "125Hz"];
const visibleColumns = ref(new Set(columns));
const visibleColumnsArray = computed(() => columnDefinitions.filter((column) => visibleColumns.value.has(column.name)));
const visibleSubSelectedColumns = computed(() =>
  columnsSubSelected
    .map((name) => columnDefinitions.find((column) => column.name === name))
    .filter(Boolean)
    .filter((column) => visibleColumns.value.has(column.name))
);

function toggleColumnVisibility(columnName) {
  // mutate then reassign a new Set to ensure Vue tracks the change
  const set = new Set(visibleColumns.value);
  if (set.has(columnName)) {
    set.delete(columnName);
  } else {
    set.add(columnName);
  }
  visibleColumns.value = set;
}

const fetchData = async () => {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/1dU5OOnf3nVgctJszmfyBjaxK69dkXte6ZL6anVTW2_M?includeGridData=true&ranges=CEA-2010-A!A1%3ABP2214&key=${import.meta.env.VITE_API_KEY}`);
  const json = await response.json();
  const allRows = json.sheets[0].data[0].rowData;

  allRows.forEach((row) => row.values.splice(19, 36));
  allRows.forEach((row) => row.values.splice(2, 11));
  allRows.forEach((row) => row.values.splice(5, 2));

  const subsWithOutputData = allRows.filter((row) => row.values[5].formattedValue && !row.values[5].formattedValue.includes("See tab"));
  subsWithOutputData.shift();
  subsWithOutputData.forEach((sub, index) => (sub.id = index));
  return subsWithOutputData;
};

function getValue(sub, index) {
  return sub.values[index]?.formattedValue || "";
}

const availableTypes = computed(() => {
  const types = new Set(unfilteredSubs.value.map((sub) => getValue(sub, 4)).filter(Boolean));
  return ["all", ...Array.from(types).sort((a, b) => a.localeCompare(b))];
});

const subsFiltered = computed(() => {
  let items = unfilteredSubs.value.filter((sub) => {
    const brand = getValue(sub, 0).toLowerCase();
    const model = getValue(sub, 1).toLowerCase();
    const type = getValue(sub, 4);
    const brandMatch = brand.includes(filterBrandText.value.toLowerCase());
    const modelMatch = model.includes(filterModelText.value.toLowerCase());
    const typeMatch = filterType.value === "all" || type === filterType.value;
    return brandMatch && modelMatch && typeMatch;
  });

  const sortIndexMap = { brand: 0, model: 1, type: 4, output20hz: 10 };
  const fieldIndex = sortIndexMap[sortBy.value];

  items = [...items].sort((a, b) => {
    const aRaw = getValue(a, fieldIndex);
    const bRaw = getValue(b, fieldIndex);

    if (sortBy.value === "output20hz") {
      const aNum = Number.parseFloat(aRaw) || -Infinity;
      const bNum = Number.parseFloat(bRaw) || -Infinity;
      return sortDirection.value === "asc" ? aNum - bNum : bNum - aNum;
    }

    const cmp = aRaw.localeCompare(bRaw);
    return sortDirection.value === "asc" ? cmp : -cmp;
  });

  return items;
});

function generateRandomHexColor() {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function selectSubwoofer(subwoofer) {
  if (selectedSubwooferIDs.value.includes(subwoofer.id)) return;

  const label = `${getValue(subwoofer, 0)} ${getValue(subwoofer, 1)}`;
  const data = Array.from({ length: 12 }, (_, i) => parseFloat(getValue(subwoofer, i + 7)) || 0);

  selectedSubwooferIDs.value = [...selectedSubwooferIDs.value, subwoofer.id];
  subwoofersSelected.value.push(subwoofer);
  const newDatasets = [...chartData.value.datasets, { id: subwoofer.id, label, data, borderColor: generateRandomHexColor() }];
  chartData.value = { ...chartData.value, datasets: newDatasets };
}

function deselectSubwoofer(subwoofer) {
  selectedSubwooferIDs.value = selectedSubwooferIDs.value.filter((id) => id !== subwoofer.id);
  subwoofersSelected.value = subwoofersSelected.value.filter((sub) => sub.id !== subwoofer.id);
  const filteredDatasets = chartData.value.datasets.filter((dataset) => dataset.id !== subwoofer.id);
  chartData.value = { ...chartData.value, datasets: filteredDatasets };
}

function toggleSelection(subwoofer) {
  if (isSelected(subwoofer)) {
    deselectSubwoofer(subwoofer);
  } else {
    selectSubwoofer(subwoofer);
  }
}

function handleChecked(event, subwoofer) {
  if (event.target.checked) {
    selectSubwoofer(subwoofer);
    return;
  }
  deselectSubwoofer(subwoofer);
}

function clearSelections() {
  selectedSubwooferIDs.value = [];
  subwoofersSelected.value = [];
  chartData.value.datasets = [];
}

function isSelected(subwoofer) {
  return selectedSubwooferIDs.value.includes(subwoofer.id);
}

onMounted(async () => {
  const mq = window.matchMedia("(max-width: 768px)");
  const updateMobile = () => {
    isMobile.value = mq.matches;
  };

  updateMobile();
  mq.addEventListener("change", updateMobile);

  try {
    const data = await fetchData();
    unfilteredSubs.value = data;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <main class="flex min-h-screen flex-col gap-6 p-5 max-md:p-4">
    <div v-if="loading" class="flex min-h-[calc(100vh-2.5rem)] items-center justify-center">
      <div class="flex flex-col items-center gap-4 rounded-[1.25rem] bg-white/95 px-10 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.15)]">
        <div class="h-12 w-12 animate-spin rounded-full border-[0.45rem] border-blue-500/20 border-t-blue-500"></div>
        <p>Getting data...</p>
      </div>
    </div>

    <div v-else>
      <section class="mb-6 flex items-center justify-between gap-4 rounded-3xl bg-slate-900/90 px-5 py-6 text-white shadow-[0_18px_60px_rgba(15,23,42,0.15)] max-lg:flex-col max-lg:items-start max-md:p-5">
      <div>
        <p class="mb-2 text-xs uppercase tracking-[0.25em] opacity-85">CEA-2010-A | 2m peak SPL</p>
        <h1 class="m-0 text-4xl font-bold leading-tight lg:text-[2.75rem]">Subwoofer Comparison</h1>
        <i class="mt-2 block max-w-2xl text-slate-200/95">Source: Subwoofer Comparison Spreadsheet made by sweetchaos on Audio Science Review.</i>
      </div>
      <div class="flex flex-wrap items-center gap-4 max-lg:w-full max-lg:justify-between">
        <span class="text-base font-semibold">{{ subsFiltered.length }} subwoofers</span>
        <button class="cursor-pointer rounded-[0.85rem] border border-slate-400/35 bg-white px-4 py-3 text-[0.95rem] font-semibold text-slate-900 transition duration-200 hover:-translate-y-px hover:disabled:translate-y-0 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-55" @click="clearSelections" :disabled="subwoofersSelected.length === 0">Clear selection</button>
      </div>
    </section>

    <splitpanes class="default-theme max-md:min-h-0 max-md:[&.splitpanes--horizontal]:flex-col max-md:[&.splitpanes--horizontal>.splitpanes__pane:first-child]:order-2 max-md:[&.splitpanes--horizontal>.splitpanes__pane:last-child]:order-1 max-md:[&.splitpanes--horizontal>.splitpanes__splitter]:order-3" :horizontal="isMobile">
      <pane max-size="55" class="p-1 max-md:p-0">
        <section class="rounded-[1.25rem] bg-white/90 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <div class="mb-4 grid grid-cols-2 gap-3 max-lg:grid-cols-1">
            <input v-model="filterBrandText" class="rounded-[0.85rem] border border-slate-400/35 bg-white px-4 py-3 text-[0.95rem] transition duration-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15" type="text" placeholder="Filter by brand" aria-label="Filter by brand" />
            <input v-model="filterModelText" class="rounded-[0.85rem] border border-slate-400/35 bg-white px-4 py-3 text-[0.95rem] transition duration-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15" type="text" placeholder="Filter by model" aria-label="Filter by model" />
            <select v-model="filterType" class="rounded-[0.85rem] border border-slate-400/35 bg-white px-4 py-3 text-[0.95rem] transition duration-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15" aria-label="Filter by type">
              <option v-for="type in availableTypes" :key="type" :value="type">
                {{ type === "all" ? "All types" : type }}
              </option>
            </select>
            <select v-model="sortBy" class="rounded-[0.85rem] border border-slate-400/35 bg-white px-4 py-3 text-[0.95rem] transition duration-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15" aria-label="Sort by">
              <option value="brand">Sort: Brand</option>
              <option value="model">Sort: Model</option>
              <option value="type">Sort: Type</option>
              <option value="output20hz">Sort: 20Hz Output</option>
            </select>
            <button class="cursor-pointer rounded-[0.85rem] border border-slate-400/35 bg-white px-4 py-3 text-[0.95rem] font-semibold text-slate-900 transition duration-200 hover:-translate-y-px focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15" @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'">
              {{ sortDirection === 'asc' ? 'Ascending' : 'Descending' }}
            </button>
            <div class="col-span-2 grid gap-3 max-lg:col-span-1">
              <span class="text-sm font-semibold text-gray-600">Visible columns</span>
              <div class="flex flex-wrap gap-2">
                <label v-for="columnName in columns" :key="columnName" class="inline-flex items-center gap-1.5 rounded-[0.85rem] bg-slate-400/10 px-3 py-2 text-[0.82rem] text-slate-700">
                  <input
                    type="checkbox"
                    :checked="visibleColumns.has(columnName)"
                    @change="toggleColumnVisibility(columnName)"
                  />
                  <span>{{ columnName }}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="overflow-x-auto rounded-2xl bg-white p-2">
            <table class="w-full min-w-full border-collapse">
              <thead>
                <tr>
                  <th class="sticky top-0 border-b-2 border-slate-400/20 bg-slate-100 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.08em] text-slate-700">Select</th>
                  <th class="sticky top-0 border-b-2 border-slate-400/20 bg-slate-100 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.08em] text-slate-700" v-for="column in visibleColumnsArray" :key="column.name">{{ column.name }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="subsFiltered.length === 0">
                  <td :colspan="visibleColumnsArray.length + 1" class="px-4 py-12 text-center text-slate-500">
                    <p v-if="filterBrandText || filterModelText">No matches found.</p>
                    <p v-else>Loading subwoofers...</p>
                  </td>
                </tr>
                <tr
                  v-for="subwoofer in subsFiltered"
                  :key="subwoofer.id"
                  :class="['cursor-pointer transition-colors duration-150 hover:bg-slate-50', isSelected(subwoofer) ? 'bg-emerald-500/10' : '']"
                  @click="toggleSelection(subwoofer)"
                >
                  <td class="border-b border-slate-400/20 px-3 py-3 text-center text-sm">
                    <input
                      type="checkbox"
                      :checked="isSelected(subwoofer)"
                      @change="(event) => handleChecked(event, subwoofer)"
                      @click.stop
                    />
                  </td>
                  <td class="border-b border-slate-400/20 px-3 py-3 text-center text-sm" v-for="column in visibleColumnsArray" :key="`${subwoofer.id}-${column.index}`">{{ getValue(subwoofer, column.index) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </pane>

      <pane class="p-1 max-md:p-0">
        <div class="flex flex-col gap-4">
          <section class="flex min-h-96 flex-col rounded-[1.25rem] bg-white/90 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
            <div class="flex min-h-64 flex-1 items-stretch justify-center py-2">
              <Graph v-if="chartData.datasets.length > 0" :chartData="chartData" />
              <p v-else class="text-center leading-7 text-slate-500">Select one or more subwoofers to compare output curves.</p>
            </div>
          </section>

          <section class="overflow-hidden rounded-[1.25rem] bg-white/90 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
            <h2 class="mb-3 text-base font-bold">Selected Subwoofers</h2>
            <div v-if="subwoofersSelected.length > 0" class="overflow-x-auto rounded-2xl bg-white p-2">
              <table class="w-full min-w-full border-collapse">
                <thead>
                  <tr>
                    <th class="sticky top-0 border-b-2 border-slate-400/20 bg-slate-100 px-2.5 py-2.5 text-center text-xs font-bold uppercase tracking-[0.08em] text-slate-700" v-for="column in visibleSubSelectedColumns" :key="column.name">{{ column.name }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="subwoofer in subwoofersSelected" :key="subwoofer.id">
                    <td class="border-b border-slate-400/20 px-2.5 py-2.5 text-center text-sm" v-for="column in visibleSubSelectedColumns" :key="`${subwoofer.id}-selected-${column.index}`">{{ getValue(subwoofer, column.index) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-center leading-7 text-slate-500">No subwoofers selected yet.</p>
          </section>
        </div>
      </pane>
    </splitpanes>
    </div>
  </main>
</template>

