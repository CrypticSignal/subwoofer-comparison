<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
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
const sortColumns = { Brand: "brand", Model: "model", Type: "type", "20Hz": "output20hz" };

function sortColumn(columnName) {
  const field = sortColumns[columnName];
  if (sortBy.value === field) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = field;
    sortDirection.value = "asc";
  }
}
const isMobile = ref(false);
const loading = ref(true);
const comparisonPanel = ref(null);
const openFilters = ref(new Set());

function toggleFilter(name) {
  const next = new Set(openFilters.value);
  next.has(name) ? next.delete(name) : next.add(name);
  openFilters.value = next;
}

function hasFilter(name) {
  return name === "Brand" ? Boolean(filterBrandText.value) : name === "Model" ? Boolean(filterModelText.value) : name === "Type" && filterType.value !== "all";
}

function viewComparison() {
  comparisonPanel.value?.focus({ preventScroll: true });
  comparisonPanel.value?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}

function frozenColumnClass(name) {
  return { 'frozen-brand': name === 'Brand', 'frozen-model': name === 'Model', 'model-first': name === 'Model' && !visibleColumns.value.has('Brand') };
}

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
const hiddenColumns = computed(() => columns.filter((name) => !visibleColumns.value.has(name)));
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
    // A hidden column must not leave an invisible filter active.
    if (columnName === "Brand") filterBrandText.value = "";
    if (columnName === "Model") filterModelText.value = "";
    if (columnName === "Type") filterType.value = "all";
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

let removeMobileListener;
onUnmounted(() => removeMobileListener?.());

onMounted(async () => {
  const mq = window.matchMedia("(max-width: 768px)");
  const updateMobile = () => {
    isMobile.value = mq.matches;
  };

  updateMobile();
  if (mq.matches) visibleColumns.value = new Set(["Brand", "Model", "Type", "20Hz", "31.5Hz", "50Hz"]);
  mq.addEventListener("change", updateMobile);
  removeMobileListener = () => mq.removeEventListener("change", updateMobile);

  try {
    const data = await fetchData();
    unfilteredSubs.value = data;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <main class="flex min-h-screen flex-col gap-6 p-5 max-md:p-4" :class="{ 'comparison-active': isMobile && subwoofersSelected.length > 0 }">
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

    <splitpanes
      class="default-theme comparison-layout"
      :class="{ 'has-selection': subwoofersSelected.length > 0 }"
      :horizontal="isMobile"
    >
      <pane max-size="55" class="catalog-pane p-1 max-md:p-0">
        <section class="rounded-[1.25rem] bg-white/90 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <details v-if="hiddenColumns.length > 0" class="mb-3 text-sm text-slate-700">
            <summary class="cursor-pointer py-2 font-semibold">More columns ({{ hiddenColumns.length }} hidden)</summary>
            <div class="flex flex-wrap gap-2 pt-2">
              <label v-for="columnName in hiddenColumns" :key="columnName" class="inline-flex cursor-pointer items-center gap-1.5 rounded-[0.85rem] bg-slate-400/10 px-3 py-2 text-[0.82rem] text-slate-700">
                <input
                  type="checkbox"
                  :checked="false"
                  :aria-label="`Show ${columnName} column`"
                  @change="toggleColumnVisibility(columnName)"
                />
                <span>{{ columnName }}</span>
              </label>
            </div>
          </details>

          <div class="catalog-scroll max-h-[75dvh] overflow-auto rounded-2xl bg-white p-2">
            <table class="w-full min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th class="sticky top-0 z-10 border-b-2 border-slate-400/20 bg-slate-100 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.08em] text-slate-700">Select</th>
                  <th scope="col" class="sticky top-0 z-10 border-b-2 border-slate-400/20 bg-slate-100 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.08em] text-slate-700" v-for="column in visibleColumnsArray" :key="column.name" :class="frozenColumnClass(column.name)" :aria-sort="sortColumns[column.name] === sortBy ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined">
                    <div class="column-heading flex flex-wrap items-center justify-center gap-1">
                      <label class="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap py-1">
                        <input
                          type="checkbox"
                          :checked="visibleColumns.has(column.name)"
                          :aria-label="`Show ${column.name} column`"
                          @change="toggleColumnVisibility(column.name)"
                        />
                        <span>{{ column.name }}</span>
                      </label>
                      <button
                        v-if="sortColumns[column.name]"
                        type="button"
                        class="rounded p-2 text-base hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        :aria-label="`Sort by ${column.name}${sortColumns[column.name] === sortBy ? (sortDirection === 'asc' ? ', currently ascending' : ', currently descending') : ''}`"
                        @click="sortColumn(column.name)"
                      >{{ sortColumns[column.name] === sortBy ? (sortDirection === 'asc' ? '↑' : '↓') : '↕' }}</button>
                      <button
                        v-if="['Brand', 'Model', 'Type'].includes(column.name)"
                        type="button"
                        class="filter-toggle rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        :class="{ 'filter-active': hasFilter(column.name) }"
                        :aria-label="`Filter by ${column.name}${hasFilter(column.name) ? ', filter active' : ''}`"
                        :aria-expanded="openFilters.has(column.name)"
                        :aria-controls="`filter-${column.index}`"
                        @click="toggleFilter(column.name)"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 4h18l-7 8v7l-4 2v-9z" /></svg>
                      </button>
                    </div>
                    <div v-if="openFilters.has(column.name)">
                      <input
                        v-if="column.name === 'Brand'"
                        v-model="filterBrandText"
                        :id="`filter-${column.index}`"
                        class="column-filter"
                        type="search"
                        placeholder="Filter brand"
                        aria-label="Filter by brand"
                      />
                      <input
                        v-else-if="column.name === 'Model'"
                        v-model="filterModelText"
                        :id="`filter-${column.index}`"
                        class="column-filter"
                        type="search"
                        placeholder="Filter model"
                        aria-label="Filter by model"
                      />
                      <select v-else-if="column.name === 'Type'" v-model="filterType" :id="`filter-${column.index}`" class="column-filter" aria-label="Filter by type">
                        <option v-for="type in availableTypes" :key="type" :value="type">{{ type === 'all' ? 'All types' : type }}</option>
                      </select>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="subsFiltered.length === 0">
                  <td :colspan="visibleColumnsArray.length + 1" class="px-4 py-12 text-center text-slate-500">
                    <p v-if="filterBrandText || filterModelText || filterType !== 'all'">No matches found.</p>
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
                  <td class="border-b border-slate-400/20 px-3 py-3 text-center text-sm" v-for="column in visibleColumnsArray" :class="frozenColumnClass(column.name)" :key="`${subwoofer.id}-${column.index}`">{{ getValue(subwoofer, column.index) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </pane>

      <pane class="selected-pane p-1 max-md:p-0">
        <div ref="comparisonPanel" class="comparison-panel flex flex-col gap-4" tabindex="-1">
          <section class="graph-card flex min-h-96 flex-col rounded-[1.25rem] bg-white/90 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
            <div class="graph-frame flex min-h-64 flex-1 items-stretch justify-center py-2">
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
    <button
      v-if="isMobile && subwoofersSelected.length > 0"
      type="button"
      class="view-comparison rounded-full bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300"
      @click="viewComparison"
    >↑ View comparison ({{ subwoofersSelected.length }})</button>
    </div>
  </main>
</template>

<style scoped>
.filter-active {
  color: white;
  background: rgb(37 99 235);
}

.comparison-panel {
  scroll-margin-top: 1rem;
}

.view-comparison {
  position: fixed;
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  white-space: nowrap;
}

.column-filter {
  display: block;
  width: 100%;
  min-width: 8rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  border: 1px solid rgb(148 163 184 / 0.35);
  border-radius: 0.5rem;
  background: white;
  font-size: 0.875rem;
  font-weight: normal;
  letter-spacing: normal;
  text-transform: none;
}

.column-filter:focus {
  outline: 2px solid rgb(59 130 246);
  outline-offset: 2px;
}

@media (max-width: 768px) {
  .graph-card,
  .graph-frame {
    min-height: 0;
  }

  .graph-frame {
    flex: none;
  }

  .comparison-active {
    padding-bottom: calc(6rem + env(safe-area-inset-bottom, 0px));
  }

  .catalog-scroll {
    --brand-width: 6rem;
    --model-width: 7.5rem;
  }

  .catalog-scroll .frozen-brand,
  .catalog-scroll .frozen-model {
    position: sticky;
    overflow-wrap: anywhere;
    padding-left: 0.375rem;
    padding-right: 0.375rem;
    z-index: 20;
    background: white;
  }

  .catalog-scroll .frozen-brand {
    left: 0;
    width: var(--brand-width);
    min-width: var(--brand-width);
    max-width: var(--brand-width);
  }

  .catalog-scroll .frozen-model {
    left: var(--brand-width);
    width: var(--model-width);
    min-width: var(--model-width);
    max-width: var(--model-width);
    box-shadow: 2px 0 3px rgb(15 23 42 / 0.12);
  }

  .catalog-scroll .model-first {
    left: 0;
  }

  .catalog-scroll th.frozen-brand,
  .catalog-scroll th.frozen-model {
    z-index: 30;
    background: rgb(241 245 249);
  }

  .catalog-scroll tr.bg-emerald-500\/10 > .frozen-brand,
  .catalog-scroll tr.bg-emerald-500\/10 > .frozen-model {
    background: rgb(236 253 245);
  }

  .column-filter {
    min-width: 0;
  }

  .comparison-layout {
    height: auto;
    flex-direction: column;
    gap: 1rem;
  }

  .comparison-layout > .splitpanes__pane {
    /* Let both tables grow instead of using the splitter's percentage heights. */
    height: auto !important;
    overflow: visible;
  }

  .comparison-layout :deep(> .splitpanes__splitter) {
    display: none;
  }

  .comparison-layout.has-selection > .selected-pane {
    order: -1;
  }
}
</style>

