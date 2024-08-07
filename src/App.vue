<script setup>
import { onBeforeMount, ref } from "vue";
import Graph from "./components/Graph.vue";
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";

const subwoofersSelected = ref([]);
const selectedSubwooferIDs = ref(new Set());
const unfilteredSubs = ref([]);
const subsFilteredByMake = ref([]);
const filterText = ref("");
const chartData = ref({
  labels: [
    "10Hz",
    "12.5Hz",
    "15Hz",
    "20Hz",
    "25Hz",
    "31.5Hz",
    "40Hz",
    "50Hz",
    "63Hz",
    "80Hz",
    "100Hz",
    "125Hz",
  ],
  datasets: [],
});

const columns = [
  "Make",
  "Model",
  "Drivers",
  "Driver Size",
  "Type",
  "Source",
  "Mode",
  "10Hz",
  "12.5Hz",
  "15Hz",
  "20Hz",
  "25Hz",
  "31.5Hz",
  "40Hz",
  "50Hz",
  "63Hz",
  "80Hz",
  "100Hz",
  "125Hz",
];

const columnsSubSelected = [
  "Model",
  "Source",
  "Mode",
  "10Hz",
  "12.5Hz",
  "15Hz",
  "20Hz",
  "25Hz",
  "31.5Hz",
  "40Hz",
  "50Hz",
  "63Hz",
  "80Hz",
  "100Hz",
  "125Hz",
];

const fetchData = async () => {
  console.log("Making a request using Google Sheets API...");
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/1dU5OOnf3nVgctJszmfyBjaxK69dkXte6ZL6anVTW2_M?includeGridData=true&ranges=CEA-2010-A!A1%3ABP2214&key=${
      import.meta.env.VITE_API_KEY
    }`
  );

  const json = await response.json();
  const allRows = json.sheets[0].data[0].rowData;
  console.log(allRows);

  // Delete the elements from index 19 to index 54
  const deleteCount1 = 54 - 19 + 1;
  allRows.forEach((row) => row.values.splice(19, deleteCount1));
  // Delete the elements from index 2 to index 12
  const deleteCount2 = 12 - 2 + 1;
  allRows.forEach((row) => row.values.splice(2, deleteCount2));
  // Delete the elements from index 5 to index 6
  allRows.forEach((row) => row.values.splice(5, 2));
  // Only keep the subs that have a source for the CEA-2010-A data
  // which is not 'See tab "Others"'
  const subsWithOutputData = allRows.filter(
    (row) => row.values[5].formattedValue && !row.values[5].formattedValue.includes("See tab")
  );
  // Remove the row for the column names
  subsWithOutputData.shift();
  console.log(subsWithOutputData);
  // Give each subwoofer an id
  subsWithOutputData.forEach((sub, index) => (sub.id = index));
  console.log(subsWithOutputData);

  return subsWithOutputData;
};

const handleInput = (e) => {
  filterText.value = e.target.value.toLowerCase();
  subsFilteredByMake.value = unfilteredSubs.value.filter((sub) =>
    sub.values[0].formattedValue.toLowerCase().includes(filterText.value)
  );
};

function generateRandomHexColor() {
  // Generate a random number between 0 and 255 for red, green and blue
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  // Convert each component to a 2-digit hex string and concatenate them
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}`;
}

function handleChecked(event, subwoofer) {
  const label = `${subwoofer.values[0].formattedValue} ${subwoofer.values[1].formattedValue}`;

  const data = [
    subwoofer.values[7].formattedValue,
    subwoofer.values[8].formattedValue,
    subwoofer.values[9].formattedValue,
    subwoofer.values[10].formattedValue,
    subwoofer.values[11].formattedValue,
    subwoofer.values[12].formattedValue,
    subwoofer.values[13].formattedValue,
    subwoofer.values[14].formattedValue,
    subwoofer.values[15].formattedValue,
    subwoofer.values[16].formattedValue,
    subwoofer.values[17].formattedValue,
    subwoofer.values[18].formattedValue,
  ];

  chartData.value = {
    ...chartData.value,
    datasets: [
      ...chartData.value.datasets,
      {
        id: subwoofer.id,
        label,
        data,
        borderColor: generateRandomHexColor(),
      },
    ],
  };

  if (event.target.checked) {
    selectedSubwooferIDs.value.add(subwoofer.id);
    subwoofersSelected.value.push(subwoofer);
  } else {
    selectedSubwooferIDs.value.delete(subwoofer.id);
    subwoofersSelected.value = subwoofersSelected.value.filter((sub) => sub.id !== subwoofer.id);

    chartData.value.datasets = chartData.value.datasets.filter(
      (dataset) => dataset.id !== subwoofer.id
    );

    return;
  }
}

function isSelected(subwoofer) {
  return selectedSubwooferIDs.value.has(subwoofer.id);
}

onBeforeMount(async () => {
  const data = await fetchData();
  unfilteredSubs.value = data;
  subsFilteredByMake.value = data;
});
</script>

<template>
  <p class="text-center">CEA-2010-A Data</p>
  <splitpanes class="default-theme">
    <pane max-size="50">
      <input @input="handleInput" type="text" placeholder="Filter by make" />
      <span class="ml-2" v-if="subsFilteredByMake.length"
        >{{ subsFilteredByMake.length }} subwoofers found.</span
      >
      <div class="h-90v overflow-auto">
        <table class="border">
          <thead>
            <tr>
              <th class="text-center">Select</th>
              <th class="text-center border" v-for="columnName in columns" :key="columnName">
                {{ columnName }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-show="subsFilteredByMake.length === 0">
              <td>
                <p v-if="filterText">No matches found</p>
                <p v-else>Retrieving subwoofers...</p>
              </td>
            </tr>
            <tr
              :class="selectedSubwooferIDs.has(subwoofer.id) ? 'bg-green-100' : 'bg-white'"
              v-for="subwoofer in subsFilteredByMake"
              :key="subwoofer.id"
              @click="() => handleSubSelected(subwoofer)"
            >
              <td class="text-center">
                <input
                  type="checkbox"
                  :checked="isSelected(subwoofer)"
                  @change="(event) => handleChecked(event, subwoofer)"
                />
              </td>
              <td class="text-center border">{{ subwoofer.values[0].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[1].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[2].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[3].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[4].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[5].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[6].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[7].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[8].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[9].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[10].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[11].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[12].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[13].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[14].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[15].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[16].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[17].formattedValue }}</td>
              <td class="text-center border">{{ subwoofer.values[18].formattedValue }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </pane>
    <pane>
      <splitpanes horizontal>
        <pane>
          <Graph v-if="chartData.datasets.length > 0" :chartData="chartData"></Graph>
        </pane>
        <pane>
          <div v-if="subwoofersSelected.length > 0" class="h-40v overflow-auto">
            <table>
              <thead>
                <tr>
                  <th
                    class="text-left border"
                    v-for="columnName in columnsSubSelected"
                    :key="columnName"
                  >
                    {{ columnName }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="subwoofer in subwoofersSelected"
                  :key="subwoofer._uniqueKey"
                  @click="() => handleSubSelected(subwoofer)"
                >
                  <td class="text-center border">{{ subwoofer.values[1].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[5].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[6].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[7].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[8].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[9].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[10].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[11].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[12].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[13].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[14].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[15].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[16].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[17].formattedValue }}</td>
                  <td class="text-center border">{{ subwoofer.values[18].formattedValue }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </pane>
      </splitpanes>
    </pane>
  </splitpanes>
</template>
