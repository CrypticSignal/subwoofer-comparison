<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import Graph from "./components/Graph.vue";
import { readSubwooferCache, saveSubwooferCache } from "./lib/subwooferCache.js";
import { parseSpreadsheetRows } from "./lib/spreadsheet.js";
import { comparisonUrl, parseSelection, resolveSelection, selectionReferences } from "./lib/comparisonSelection.js";
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";

const subwoofersSelected = ref([]);
const selectedSubwooferIDs = ref([]); // store ids in an array for reliable reactivity
const unfilteredSubs = ref([]);
const filterBrandText = ref("");
const filterModelText = ref("");
const filterType = ref("all");
const filterSource = ref("");
const sortBy = ref("Brand");
const sortDirection = ref("asc");

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
const dataError = ref("");
const fetching = ref(false);
const lastFetched = ref(null);
const lastFetchedLabel = computed(() => lastFetched.value ? new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium", timeStyle: "short",
}).format(lastFetched.value) : "Not yet fetched");
const comparisonPanel = ref(null);
const openFilters = ref(new Set());
const selectionStorageKey = "subwoofer-comparison:selection:v1";
const selectionNotice = ref("");
const shareStatus = ref("");
const shareLink = ref("");
const shareLinkInput = ref(null);
let initialSelection = [];
let selectionsRestored = false;

function readInitialSelection() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (hash.has("compare")) {
    const shared = parseSelection(hash.get("compare"));
    if (!shared) selectionNotice.value = "This comparison link could not be read. Select subwoofers to start a new comparison.";
    return shared || [];
  }
  try {
    return parseSelection(localStorage.getItem(selectionStorageKey)) || [];
  } catch {
    return [];
  }
}

function restoreSelections() {
  if (selectionsRestored) return;
  const matches = resolveSelection(initialSelection, unfilteredSubs.value);
  for (const row of matches) selectSubwoofer(row);
  selectionsRestored = true;
  if (matches.length < initialSelection.length) {
    selectionNotice.value = "Some saved subwoofers are no longer available. The remaining selections have been restored.";
  }
}

watch(() => subwoofersSelected.value.map((sub) => sub.id), () => {
  if (!selectionsRestored) return;
  const refs = selectionReferences(subwoofersSelected.value, unfilteredSubs.value);
  try {
    localStorage.setItem(selectionStorageKey, JSON.stringify(refs));
  } catch {
    // Selections can still be shared when browser storage is unavailable.
  }
  try {
    window.history.replaceState(window.history.state, "", comparisonUrl(window.location.href, refs));
  } catch {
    // Sharing still works if updating the address bar is unavailable.
  }
  shareStatus.value = "";
  shareLink.value = "";
});

async function shareComparison() {
  const url = comparisonUrl(window.location.href, selectionReferences(subwoofersSelected.value, unfilteredSubs.value));
  try {
    await navigator.clipboard.writeText(url);
    shareStatus.value = "Comparison link copied.";
    shareLink.value = "";
  } catch {
    shareLink.value = url;
    shareStatus.value = "Copy this link to share your comparison.";
    await nextTick();
    shareLinkInput.value?.focus();
    shareLinkInput.value?.select();
  }
}

function toggleFilter(name) {
  const next = new Set(openFilters.value);
  next.has(name) ? next.delete(name) : next.add(name);
  openFilters.value = next;
}

function hasFilter(name) {
  return name === "Brand" ? Boolean(filterBrandText.value) : name === "Model" ? Boolean(filterModelText.value) : name === "Source" ? Boolean(filterSource.value) : name === "Type" && filterType.value !== "all";
}

function viewComparison() {
  comparisonPanel.value?.focus({ preventScroll: true });
  comparisonPanel.value?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}

function frozenColumnClass(name) {
  return { 'frozen-model': name === 'Model' };
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
  { name: "Mode", index: 6 },
  { name: "Source", index: 5 },
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
const sortColumns = Object.fromEntries(columns.map((name) => [name, name]));
const visibleColumns = ref(new Set(columns.filter((name) => name !== "Drivers")));
const columnPreferenceKey = "subwoofer-comparison:visible-columns:v1";

function restoreColumnPreferences(key = columnPreferenceKey, target = visibleColumns, allowed = columns) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (!Array.isArray(saved) || !saved.every((name) => typeof name === "string")) return false;
    const knownColumns = saved.filter((name) => allowed.includes(name));
    if (knownColumns.length === 0) return false;
    target.value = new Set(knownColumns);
    return true;
  } catch {
    return false;
  }
}
const hiddenColumns = computed(() => columns.filter((name) => !visibleColumns.value.has(name)));
const visibleColumnsArray = computed(() => columnDefinitions.filter((column) => visibleColumns.value.has(column.name)));
const comparisonColumns = columnDefinitions.filter((column) => ["Model", "Mode", "Source"].includes(column.name) || column.index >= 7);
const comparisonColumnNames = comparisonColumns.map((column) => column.name);
const comparisonPreferenceKey = "subwoofer-comparison:comparison-columns:v3";
const comparisonVisibleColumns = ref(new Set(comparisonColumnNames));
const visibleSubSelectedColumns = computed(() => comparisonColumns.filter((column) => comparisonVisibleColumns.value.has(column.name)));
const hiddenComparisonColumns = computed(() => comparisonColumnNames.filter((name) => !comparisonVisibleColumns.value.has(name)));
const comparisonSortBy = ref("Model");
const comparisonSortDirection = ref("asc");
const showOutputDifferences = ref(false);
const sortedSelectedSubwoofers = computed(() => [...subwoofersSelected.value].sort((a, b) => compareRows(a, b, comparisonSortBy.value, comparisonSortDirection.value)));
const highestSelectedOutputs = computed(() => {
  const highest = new Map();
  for (const column of comparisonColumns.filter((column) => column.index >= 7)) {
    const values = subwoofersSelected.value.map((sub) => Number.parseFloat(getValue(sub, column.index))).filter(Number.isFinite);
    if (values.length) highest.set(column.index, Math.max(...values));
  }
  return highest;
});

function isHighestOutput(sub, column) {
  const output = Number.parseFloat(getValue(sub, column.index));
  return column.index >= 7 && Number.isFinite(output) && output === highestSelectedOutputs.value.get(column.index);
}

function outputDifference(sub, column) {
  if (column.index < 7) return null;
  const output = Number.parseFloat(getValue(sub, column.index));
  const highest = highestSelectedOutputs.value.get(column.index);
  if (!Number.isFinite(output) || !Number.isFinite(highest)) return null;
  const gap = (highest - output).toFixed(1);
  return gap === "0.0" ? "0.0 dB" : `−${gap} dB`;
}

function toggleComparisonColumn(name) {
  const next = new Set(comparisonVisibleColumns.value);
  if (next.has(name)) {
    if (next.size === 1) return;
    next.delete(name);
  } else {
    next.add(name);
  }
  comparisonVisibleColumns.value = next;
  try {
    localStorage.setItem(comparisonPreferenceKey, JSON.stringify([...next]));
  } catch {
    // The controls still work when browser storage is unavailable.
  }
}

function sortComparisonColumn(name) {
  if (comparisonSortBy.value === name) {
    comparisonSortDirection.value = comparisonSortDirection.value === "asc" ? "desc" : "asc";
  } else {
    comparisonSortBy.value = name;
    comparisonSortDirection.value = "asc";
  }
}

function toggleColumnVisibility(columnName) {
  // mutate then reassign a new Set to ensure Vue tracks the change
  const set = new Set(visibleColumns.value);
  if (set.has(columnName)) {
    set.delete(columnName);
    // A hidden column must not leave an invisible filter active.
    if (columnName === "Brand") filterBrandText.value = "";
    if (columnName === "Model") filterModelText.value = "";
    if (columnName === "Type") filterType.value = "all";
    if (columnName === "Source") filterSource.value = "";
  } else {
    set.add(columnName);
  }
  visibleColumns.value = set;
  try {
    localStorage.setItem(columnPreferenceKey, JSON.stringify([...set]));
  } catch {
    // Visibility still works for this visit when browser storage is unavailable.
  }
}

const fetchData = async () => {
  const url = new URL("https://sheets.googleapis.com/v4/spreadsheets/1dU5OOnf3nVgctJszmfyBjaxK69dkXte6ZL6anVTW2_M");
  url.searchParams.set("ranges", "'CEA-2010-A'!A:BP");
  url.searchParams.set("fields", "sheets(data(rowData(values(formattedValue,effectiveValue))))");
  url.searchParams.set("key", import.meta.env.VITE_API_KEY);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to fetch subwoofer data");
  const json = await response.json();
  return parseSpreadsheetRows(json.sheets?.[0]?.data?.[0]?.rowData);
};

function applyFetchedRows(rows) {
  // Row positions can change in the sheet. Match selections by their identifying
  // fields, then rebuild their outputs while keeping existing graph colours.
  if (!selectionsRestored) {
    unfilteredSubs.value = rows;
    restoreSelections();
    return;
  }
  const matches = subwoofersSelected.value.flatMap((old) => {
    const current = resolveSelection(selectionReferences([old], unfilteredSubs.value), rows)[0];
    return current ? [{ old, current }] : [];
  });
  const previousDatasets = new Map(chartData.value.datasets.map((dataset) => [dataset.id, dataset]));
  unfilteredSubs.value = rows;
  subwoofersSelected.value = matches.map((match) => match.current);
  selectedSubwooferIDs.value = matches.map((match) => match.current.id);
  chartData.value = { ...chartData.value, datasets: matches.map(({ old, current }) => ({
    ...previousDatasets.get(old.id), id: current.id, data: outputData(current),
  })) };
}

async function loadData(force = false) {
  if (fetching.value) return;
  dataError.value = "";
  const cached = readSubwooferCache();
  if (cached && unfilteredSubs.value.length === 0) {
    unfilteredSubs.value = cached.rows;
    lastFetched.value = cached.savedAt;
    restoreSelections();
  }
  if (unfilteredSubs.value.length > 0) {
    loading.value = false;
    if (!force && cached?.fresh) return;
  } else {
    loading.value = true;
  }

  fetching.value = true;
  try {
    const rows = await fetchData();
    const fetchedAt = Date.now();
    applyFetchedRows(rows);
    lastFetched.value = fetchedAt;
    saveSubwooferCache(rows, fetchedAt);
  } catch {
    dataError.value = unfilteredSubs.value.length ? "Couldn't refresh data. Showing previously fetched subwoofer data." : "Couldn't load subwoofer data. Please try again.";
  } finally {
    fetching.value = false;
    loading.value = false;
  }
}

function getValue(sub, index) {
  return sub.values[index]?.formattedValue || "";
}

const availableTypes = computed(() => {
  const types = new Set(unfilteredSubs.value.map((sub) => getValue(sub, 4)).filter(Boolean));
  return ["all", ...Array.from(types).sort((a, b) => a.localeCompare(b))];
});
const availableSources = computed(() => [...new Set(unfilteredSubs.value.map((sub) => getValue(sub, 5)).filter(Boolean))].sort((a, b) => a.localeCompare(b)));

const subsFiltered = computed(() => {
  let items = unfilteredSubs.value.filter((sub) => {
    const brand = getValue(sub, 0).toLowerCase();
    const model = getValue(sub, 1).toLowerCase();
    const type = getValue(sub, 4);
    const brandMatch = brand.includes(filterBrandText.value.toLowerCase());
    const modelMatch = model.includes(filterModelText.value.toLowerCase());
    const typeMatch = filterType.value === "all" || type === filterType.value;
    const sourceMatch = !filterSource.value || getValue(sub, 5) === filterSource.value;
    return brandMatch && modelMatch && typeMatch && sourceMatch;
  });

  return [...items].sort((a, b) => compareRows(a, b, sortBy.value, sortDirection.value));
});

function compareRows(a, b, columnName, direction) {
  const fieldIndex = columnDefinitions.find((column) => column.name === columnName).index;
  const aRaw = getValue(a, fieldIndex);
  const bRaw = getValue(b, fieldIndex);

  if (fieldIndex === 2 || fieldIndex === 3 || fieldIndex >= 7) {
    const aNum = Number.parseFloat(aRaw);
    const bNum = Number.parseFloat(bRaw);
    // Keep absent/non-numeric measurements last in either direction.
    if (!Number.isFinite(aNum)) return Number.isFinite(bNum) ? 1 : 0;
    if (!Number.isFinite(bNum)) return -1;
    return direction === "asc" ? aNum - bNum : bNum - aNum;
  }

  const cmp = aRaw.localeCompare(bRaw, undefined, { numeric: true, sensitivity: "base" });
  return direction === "asc" ? cmp : -cmp;
}

function nextChartColor() {
  const palette = ["#2563eb", "#c2410c", "#047857", "#a21caf", "#0e7490", "#be123c"];
  const used = new Set(chartData.value.datasets.map((dataset) => dataset.borderColor));
  const available = palette.find((color) => !used.has(color));
  if (available) return available;
  // Add unique hues beyond the palette instead of repeating colours.
  let index = 0;
  let color;
  do {
    color = `hsl(${(index++ * 137.508) % 360} 70% 38%)`;
  } while (used.has(color));
  return color;
}

function outputData(subwoofer) {
  return Array.from({ length: 12 }, (_, i) => {
    const output = Number.parseFloat(getValue(subwoofer, i + 7));
    return Number.isFinite(output) ? output : null;
  });
}

function selectSubwoofer(subwoofer) {
  if (selectedSubwooferIDs.value.includes(subwoofer.id)) return;

  const label = `${getValue(subwoofer, 0)} ${getValue(subwoofer, 1)}`;
  const data = outputData(subwoofer);

  selectedSubwooferIDs.value = [...selectedSubwooferIDs.value, subwoofer.id];
  subwoofersSelected.value.push(subwoofer);
  const color = nextChartColor();
  const newDatasets = [...chartData.value.datasets, { id: subwoofer.id, label, data, borderColor: color, backgroundColor: color }];
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

function clearSelections() {
  selectedSubwooferIDs.value = [];
  subwoofersSelected.value = [];
  chartData.value.datasets = [];
}

function isSelected(subwoofer) {
  return selectedSubwooferIDs.value.includes(subwoofer.id);
}

let removeMobileListener;
function restoreLocationSelection() {
  selectionNotice.value = "";
  initialSelection = readInitialSelection();
  selectionsRestored = false;
  clearSelections();
  if (unfilteredSubs.value.length) restoreSelections();
}

onUnmounted(() => {
  removeMobileListener?.();
  window.removeEventListener("hashchange", restoreLocationSelection);
});

onMounted(async () => {
  initialSelection = readInitialSelection();
  window.addEventListener("hashchange", restoreLocationSelection);
  const mq = window.matchMedia("(max-width: 768px)");
  const updateMobile = () => {
    isMobile.value = mq.matches;
  };

  updateMobile();
  restoreColumnPreferences();
  if (!restoreColumnPreferences(comparisonPreferenceKey, comparisonVisibleColumns, comparisonColumnNames)) {
    const fromV2 = restoreColumnPreferences("subwoofer-comparison:comparison-columns:v2", comparisonVisibleColumns, comparisonColumnNames);
    const fromV1 = !fromV2 && restoreColumnPreferences("subwoofer-comparison:comparison-columns:v1", comparisonVisibleColumns, comparisonColumnNames);
    if (fromV2 || fromV1) {
      // Add newly available columns once without resetting saved choices.
      comparisonVisibleColumns.value.add("Source");
      if (fromV1) comparisonVisibleColumns.value.add("Mode");
      try {
        localStorage.setItem(comparisonPreferenceKey, JSON.stringify([...comparisonVisibleColumns.value]));
      } catch {
        // The columns still work when browser storage is unavailable.
      }
    }
  }
  mq.addEventListener("change", updateMobile);
  removeMobileListener = () => mq.removeEventListener("change", updateMobile);

  await loadData();
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
      <p v-if="selectionNotice" role="status" class="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{{ selectionNotice }}</p>
      <div v-if="dataError" role="status" class="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        {{ dataError }}
        <button type="button" class="ml-2 rounded px-2 py-1 font-semibold underline focus:ring-2 focus:ring-amber-600 disabled:opacity-50" :disabled="fetching" @click="loadData(true)">Retry</button>
      </div>
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

    <div class="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <p role="status">
        Last fetched:
        <time v-if="lastFetched" :datetime="new Date(lastFetched).toISOString()" :title="new Date(lastFetched).toString()">{{ lastFetchedLabel }}</time>
        <span v-else>{{ lastFetchedLabel }}</span>
      </p>
      <button type="button" class="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" :disabled="fetching" :aria-busy="fetching" @click="loadData(true)">{{ fetching ? 'Refreshing…' : 'Refresh data' }}</button>
    </div>

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
                  <th scope="col" class="sticky top-0 z-10 border-b-2 border-slate-400/20 bg-slate-100 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.08em] text-slate-700" v-for="column in visibleColumnsArray" :key="column.name" :class="frozenColumnClass(column.name)" :aria-sort="sortColumns[column.name] === sortBy ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined">
                    <div class="column-heading">
                      <label class="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap py-1">
                        <input
                          type="checkbox"
                          :checked="visibleColumns.has(column.name)"
                          :disabled="visibleColumns.size === 1"
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
                        v-if="['Brand', 'Model', 'Type', 'Source'].includes(column.name)"
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
                      <select v-else-if="column.name === 'Source'" v-model="filterSource" :id="`filter-${column.index}`" class="column-filter" aria-label="Filter by source">
                        <option value="">All sources</option>
                        <option v-for="source in availableSources" :key="source" :value="source">{{ source }}</option>
                      </select>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="subsFiltered.length === 0">
                  <td :colspan="visibleColumnsArray.length" class="px-4 py-12 text-center text-slate-500">
                    <p v-if="filterBrandText || filterModelText || filterType !== 'all' || filterSource">No matches found.</p>
                    <p v-else>{{ dataError ? 'Subwoofer data is unavailable.' : 'No subwoofers found.' }}</p>
                  </td>
                </tr>
                <tr
                  v-for="subwoofer in subsFiltered"
                  :key="subwoofer.id"
                  tabindex="0"
                  :aria-selected="isSelected(subwoofer)"
                  :class="['cursor-pointer transition-colors duration-150 hover:bg-slate-50', isSelected(subwoofer) ? 'bg-emerald-500/10' : '']"
                  @click="toggleSelection(subwoofer)"
                  @keydown.enter.prevent="toggleSelection(subwoofer)"
                  @keydown.space.prevent="toggleSelection(subwoofer)"
                >
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
              <Graph v-if="chartData.datasets.length > 0" :chartData="chartData" :isMobile="isMobile" />
              <p v-else class="text-center leading-7 text-slate-500">Select one or more subwoofers to compare output curves.</p>
            </div>
            <p v-if="isMobile && chartData.datasets.length > 0" class="text-center text-xs text-slate-500">Tap the graph to compare outputs. Differences are relative to the loudest selected curve at that frequency. Vertical scale adjusts to your selection.</p>
          </section>

          <section class="overflow-hidden rounded-[1.25rem] bg-white/90 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-base font-bold">Selected Subwoofers</h2>
              <button type="button" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" :disabled="subwoofersSelected.length === 0" @click="shareComparison">Share comparison</button>
            </div>
            <label v-if="subwoofersSelected.length" class="mb-3 inline-flex cursor-pointer items-center gap-2 py-2 text-sm text-slate-700">
              <input v-model="showOutputDifferences" type="checkbox" />
              Show dB differences
            </label>
            <p v-if="showOutputDifferences && subwoofersSelected.length" class="mb-3 text-xs text-slate-500">Differences are relative to the highest selected output at each frequency.</p>
            <p v-if="shareStatus" role="status" class="mb-2 text-sm text-slate-600">{{ shareStatus }}</p>
            <input v-if="shareLink" ref="shareLinkInput" :value="shareLink" readonly aria-label="Comparison link" class="mb-3 w-full rounded-lg border border-slate-300 p-2 text-sm" @focus="$event.target.select()" />
            <div v-if="subwoofersSelected.length && !comparisonVisibleColumns.has('Model')" class="mb-3 flex flex-wrap gap-2">
              <button v-for="sub in subwoofersSelected" :key="sub.id" type="button" class="rounded-lg bg-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" :aria-label="`Remove ${getValue(sub, 0)} ${getValue(sub, 1)} from comparison`" @click="deselectSubwoofer(sub)">{{ getValue(sub, 1) }} ×</button>
            </div>
            <details v-if="subwoofersSelected.length > 0 && hiddenComparisonColumns.length > 0" class="mb-3 text-sm text-slate-700">
              <summary class="cursor-pointer py-2 font-semibold">More columns ({{ hiddenComparisonColumns.length }} hidden)</summary>
              <div class="flex flex-wrap gap-2 pt-2">
                <label v-for="name in hiddenComparisonColumns" :key="name" class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
                  <input type="checkbox" :checked="false" :aria-label="`Show ${name} column`" @change="toggleComparisonColumn(name)" />
                  {{ name }}
                </label>
              </div>
            </details>
            <div v-if="subwoofersSelected.length > 0" class="comparison-table overflow-x-auto rounded-2xl bg-white p-2">
              <table class="w-full min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th scope="col" class="sticky top-0 border-b-2 border-slate-400/20 bg-slate-100 px-2.5 py-2.5 text-center text-xs font-bold uppercase tracking-[0.08em] text-slate-700" v-for="column in visibleSubSelectedColumns" :key="column.name" :class="{ 'comparison-model': column.name === 'Model' }" :aria-sort="comparisonSortBy === column.name ? (comparisonSortDirection === 'asc' ? 'ascending' : 'descending') : undefined">
                      <div class="column-heading">
                        <label class="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap py-1">
                          <input type="checkbox" :checked="true" :disabled="comparisonVisibleColumns.size === 1" :aria-label="`Show ${column.name} column`" @change="toggleComparisonColumn(column.name)" />
                          <span>{{ column.name }}</span>
                        </label>
                        <button type="button" class="rounded p-2 text-base hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" :aria-label="`Sort by ${column.name}${comparisonSortBy === column.name ? (comparisonSortDirection === 'asc' ? ', currently ascending' : ', currently descending') : ''}`" @click="sortComparisonColumn(column.name)">
                          {{ comparisonSortBy === column.name ? (comparisonSortDirection === 'asc' ? '↑' : '↓') : '↕' }}
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="subwoofer in sortedSelectedSubwoofers" :key="subwoofer.id">
                    <td class="border-b border-slate-400/20 px-2.5 py-2.5 text-center text-sm" v-for="column in visibleSubSelectedColumns" :key="`${subwoofer.id}-selected-${column.index}`" :class="{ 'font-semibold text-green-700': isHighestOutput(subwoofer, column), 'comparison-model': column.name === 'Model' }" :title="isHighestOutput(subwoofer, column) ? 'Highest output among selected subwoofers at this frequency' : undefined">
                      <div v-if="column.name === 'Model'" class="flex items-center justify-between gap-2">
                        <span>{{ getValue(subwoofer, column.index) }}</span>
                        <button type="button" class="shrink-0 rounded-lg px-3 py-2 text-lg text-slate-600 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-blue-500" :aria-label="`Remove ${getValue(subwoofer, 0)} ${getValue(subwoofer, 1)} from comparison`" :title="`Remove ${getValue(subwoofer, 1)}`" @click="deselectSubwoofer(subwoofer)">×</button>
                      </div>
                      <template v-else>
                        {{ getValue(subwoofer, column.index) }}
                        <span v-if="showOutputDifferences && outputDifference(subwoofer, column) !== null" class="block whitespace-nowrap text-xs font-normal text-slate-500">({{ outputDifference(subwoofer, column) }})</span>
                      </template>
                    </td>
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
.comparison-table .comparison-model {
  position: sticky;
  left: 0;
  z-index: 10;
  min-width: 9rem;
  max-width: 12rem;
  overflow-wrap: anywhere;
  background: white;
  box-shadow: 2px 0 3px rgb(15 23 42 / 0.12);
}

.comparison-table th.comparison-model {
  z-index: 20;
  background: rgb(241 245 249);
}

.catalog-scroll th {
  vertical-align: top;
}

.column-heading {
  display: grid;
  grid-template-columns: repeat(2, max-content);
  grid-template-rows: 1.75rem 2.5rem;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.column-heading > label {
  grid-column: 1 / -1;
  justify-content: center;
}

.catalog-scroll tbody tr:focus-visible {
  outline: 2px solid rgb(37 99 235);
  outline-offset: -2px;
}

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
    --model-width: 7.5rem;
  }

  .catalog-scroll .frozen-model {
    position: sticky;
    overflow-wrap: anywhere;
    padding-left: 0.375rem;
    padding-right: 0.375rem;
    z-index: 20;
    background: white;
  }

  .catalog-scroll .frozen-model {
    left: 0;
    width: var(--model-width);
    min-width: var(--model-width);
    max-width: var(--model-width);
    box-shadow: 2px 0 3px rgb(15 23 42 / 0.12);
  }

  .catalog-scroll th.frozen-model {
    z-index: 30;
    background: rgb(241 245 249);
  }

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

