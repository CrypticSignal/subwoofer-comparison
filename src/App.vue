<script setup>
import { computed, onMounted, ref } from "vue";
import Graph from "./components/Graph.vue";
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";

const subwoofersSelected = ref([]);
const selectedSubwooferIDs = ref(new Set());
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
  if (visibleColumns.value.has(columnName)) {
    visibleColumns.value.delete(columnName);
  } else {
    visibleColumns.value.add(columnName);
  }
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
  if (selectedSubwooferIDs.value.has(subwoofer.id)) {
    return;
  }

  const label = `${getValue(subwoofer, 0)} ${getValue(subwoofer, 1)}`;
  const data = Array.from({ length: 12 }, (_, i) => parseFloat(getValue(subwoofer, i + 7)) || 0);

  selectedSubwooferIDs.value.add(subwoofer.id);
  subwoofersSelected.value.push(subwoofer);
  const newDatasets = [...chartData.value.datasets, { id: subwoofer.id, label, data, borderColor: generateRandomHexColor() }];
  chartData.value = { ...chartData.value, datasets: newDatasets };
}

function deselectSubwoofer(subwoofer) {
  selectedSubwooferIDs.value.delete(subwoofer.id);
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
  selectedSubwooferIDs.value = new Set();
  subwoofersSelected.value = [];
  chartData.value.datasets = [];
}

function isSelected(subwoofer) {
  return selectedSubwooferIDs.value.has(subwoofer.id);
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
  <main class="app-shell">
    <div v-if="loading" class="loader-screen">
      <div class="loader-card">
        <div class="loader-spinner"></div>
        <p>Getting subwoofer data…</p>
      </div>
    </div>

    <div v-else class="app-content">
      <section class="hero-banner">
      <div>
        <p class="eyebrow">CEA-2010-A | 2m peak SPL</p>
        <h1>Subwoofer Comparison</h1>
        <i class="hero-copy">Source: Subwoofer Comparison Spreadsheet made by sweetchaos on Audio Science Review.</i>
      </div>
      <div class="hero-stats">
        <span>{{ subsFiltered.length }} subwoofers</span>
        <button class="clear-btn" @click="clearSelections" :disabled="subwoofersSelected.length === 0">Clear selection</button>
      </div>
    </section>

    <splitpanes class="default-theme app-splitpanes" :horizontal="isMobile">
      <pane max-size="55" class="pane-panel">
        <section class="panel card">
          <div class="controls">
            <input v-model="filterBrandText" type="text" placeholder="Filter by brand" aria-label="Filter by brand" />
            <input v-model="filterModelText" type="text" placeholder="Filter by model" aria-label="Filter by model" />
            <select v-model="filterType" aria-label="Filter by type">
              <option v-for="type in availableTypes" :key="type" :value="type">
                {{ type === "all" ? "All types" : type }}
              </option>
            </select>
            <select v-model="sortBy" aria-label="Sort by">
              <option value="brand">Sort: Brand</option>
              <option value="model">Sort: Model</option>
              <option value="type">Sort: Type</option>
              <option value="output20hz">Sort: 20Hz Output</option>
            </select>
            <button class="sort-toggle" @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'">
              {{ sortDirection === 'asc' ? 'Ascending' : 'Descending' }}
            </button>
            <div class="column-controls">
              <span class="column-controls-label">Visible columns</span>
              <div class="column-checkboxes">
                <label v-for="columnName in columns" :key="columnName" class="column-checkbox">
                  <input
                    type="checkbox"
                    :checked="visibleColumns.has(columnName)"
                    @change="() => toggleColumnVisibility(columnName)"
                  />
                  <span>{{ columnName }}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="text-center sticky top-0 bg-slate-100">Select</th>
                  <th class="text-center sticky top-0 bg-slate-100" v-for="column in visibleColumnsArray" :key="column.name">{{ column.name }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="subsFiltered.length === 0" class="empty-row">
                  <td :colspan="visibleColumnsArray.length + 1" class="text-center py-10">
                    <p v-if="filterBrandText || filterModelText">No matches found.</p>
                    <p v-else>Loading subwoofers…</p>
                  </td>
                </tr>
                <tr
                  v-for="subwoofer in subsFiltered"
                  :key="subwoofer.id"
                  :class="['data-row', isSelected(subwoofer) ? 'selected-row' : '']"
                  @click="toggleSelection(subwoofer)"
                >
                  <td class="text-center">
                    <input
                      type="checkbox"
                      :checked="isSelected(subwoofer)"
                      @change="(event) => handleChecked(event, subwoofer)"
                      @click.stop
                    />
                  </td>
                  <td class="text-center" v-for="column in visibleColumnsArray" :key="`${subwoofer.id}-${column.index}`">{{ getValue(subwoofer, column.index) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </pane>

      <pane class="pane-panel">
        <div class="panel-group">
          <section class="panel card chart-panel">
            <div class="chart-content">
              <Graph v-if="chartData.datasets.length > 0" :chartData="chartData" />
              <p v-else class="placeholder-text">Select one or more subwoofers to compare output curves.</p>
            </div>
          </section>

          <section class="panel card specs-panel">
            <h2 class="panel-title">Selected Subwoofers</h2>
            <div v-if="subwoofersSelected.length > 0" class="table-container">
              <table class="data-table compact">
                <thead>
                  <tr>
                    <th class="text-center sticky top-0 bg-slate-100" v-for="column in visibleSubSelectedColumns" :key="column.name">{{ column.name }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="subwoofer in subwoofersSelected" :key="subwoofer.id">
                    <td class="text-center" v-for="column in visibleSubSelectedColumns" :key="`${subwoofer.id}-selected-${column.index}`">{{ getValue(subwoofer, column.index) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="placeholder-text">No subwoofers selected yet.</p>
          </section>
        </div>
      </pane>
    </splitpanes>
    </div>
  </main>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.hero-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 1.25rem;
  border-radius: 1.5rem;
  background: rgba(15, 23, 42, 0.9);
  color: white;
  box-shadow: 0 18px 60px rgba(15, 23, 42, 0.15);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.25em;
  font-size: 0.75rem;
  margin: 0 0 0.5rem;
  opacity: 0.85;
}

.hero-banner h1 {
  margin: 0;
  font-size: clamp(2rem, 2.5vw, 2.75rem);
}

.hero-copy {
  margin: 0.5rem 0 0;
  max-width: 42rem;
  color: rgba(226, 232, 240, 0.95);
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero-stats span {
  font-size: 1rem;
  font-weight: 600;
}

.pane-panel {
  padding: 0.25rem;
}

.panel {
  padding: 1rem;
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
}

.panel-title {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
  font-weight: 700;
}

.controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.column-controls {
  grid-column: span 2;
  display: grid;
  gap: 0.65rem;
}

.column-controls-label {
  font-size: 0.88rem;
  color: rgb(75, 85, 99);
  font-weight: 600;
}

.column-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.column-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(148, 163, 184, 0.12);
  padding: 0.45rem 0.65rem;
  border-radius: 0.85rem;
  font-size: 0.82rem;
  color: rgb(51, 65, 85);
}

.controls input,
.controls select,
.sort-toggle,
.clear-btn {
  border-radius: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  padding: 0.9rem 1rem;
  font-size: 0.95rem;
  background: white;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.controls input:focus,
.controls select:focus,
.sort-toggle:focus,
.clear-btn:focus {
  outline: none;
  border-color: rgb(59, 130, 246);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
}

.sort-toggle,
.clear-btn {
  cursor: pointer;
  font-weight: 600;
  color: rgb(15, 23, 42);
  background: white;
}

.sort-toggle:hover,
.clear-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.clear-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.table-container {
  overflow-x: auto;
  border-radius: 1rem;
  background: white;
  padding: 0.5rem;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 100%;
}

.data-table th,
.data-table td {
  padding: 0.8rem 0.75rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  font-size: 0.9rem;
}

.data-table th {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: rgb(51, 65, 85);
  border-bottom-width: 2px;
}

.data-row {
  transition: background-color 0.15s ease;
  cursor: pointer;
}

.data-row:hover {
  background: rgb(248, 250, 252);
}

.selected-row {
  background: rgba(16, 185, 129, 0.12);
}

.empty-row td {
  padding: 3rem 1rem;
  color: rgb(100, 116, 139);
}

.panel-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chart-panel {
  min-height: 24rem;
  display: flex;
  flex-direction: column;
}

.chart-content {
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 16rem;
  padding: 0.5rem 0;
}

.placeholder-text {
  color: rgb(100, 116, 139);
  text-align: center;
  line-height: 1.7;
}

.loader-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 2.5rem);
}

.loader-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 2.5rem;
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.15);
}

.loader-spinner {
  width: 3rem;
  height: 3rem;
  border-radius: 9999px;
  border: 0.45rem solid rgba(59, 130, 246, 0.22);
  border-top-color: rgb(59, 130, 246);
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.specs-panel {
  overflow: hidden;
}

.data-table.compact th,
.data-table.compact td {
  padding: 0.65rem 0.6rem;
}

@media (max-width: 1024px) {
  .controls {
    grid-template-columns: 1fr;
  }

  .hero-banner {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-stats {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 768px) {
  .app-shell {
    padding: 1rem;
  }

  .hero-banner {
    padding: 1.25rem;
  }

  .pane-panel {
    padding: 0;
  }

  .app-splitpanes {
    min-height: auto;
  }

  .splitpanes--horizontal {
    flex-direction: column;
  }

  .splitpanes--horizontal > .splitpanes__pane:first-child {
    order: 2;
  }

  .splitpanes--horizontal > .splitpanes__splitter {
    order: 3;
  }

  .splitpanes--horizontal > .splitpanes__pane:last-child {
    order: 1;
  }
}
</style>
