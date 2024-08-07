<script setup>
import { onMounted, ref } from "vue";
import axios from "axios";
import { read, utils } from "xlsx";
import Chart from "./components/Graph.vue";
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";

const subsFilteredByMake = ref([]);
const unfilteredSubs = ref([]);
const filterText = ref("");
const subwoofersSelected = ref([]);
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
  try {
    const url = `https://docs.google.com/spreadsheets/d/1dU5OOnf3nVgctJszmfyBjaxK69dkXte6ZL6anVTW2_M/edit?gid=834598950#gid=834598950`;
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const arrayBuffer = response.data;
    const workbook = read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const allData = utils.sheet_to_json(worksheet);
    console.log(allData);

    return allData.slice(1);
  } catch (error) {
    console.error("Error fetching or parsing data:", error);
    return [];
  }
};

const cleanData = (data) => {
  const keyMapping = {
    A: "Make",
    B: "Model",
    N: "Drivers",
    O: "Driver Size",
    S: "Source",
    BD: "Mode",
    BE: "10Hz",
    BF: "12.5Hz",
    BG: "15Hz",
    BH: "20Hz",
    BI: "25Hz",
    BJ: "31.5Hz",
    BK: "40Hz",
    BL: "50Hz",
    BM: "63Hz",
    BN: "80Hz",
    BO: "100Hz",
    BP: "125Hz",
    P: "Type",
  };

  const keysToDelete = new Set([
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "Q",
    "R",
    "BQ",
    "BR",
    "BS",
    "BT",
    "BU",
    "BV",
    "BW",
    "BX",
    "BY",
    "BZ",
    "CA",
    "CB",
    "CC",
    "CD",
    "CE",
    "CF",
    "CG",
    "CJ",
    "CH",
    "CI",
    "CJ",
    "CK",
    "CL",
    "CM",
    "CN",
    "CO",
    "DB",
    "DC",
    "DD",
    "DE",
  ]);

  return data
    .map((obj, index) =>
      Object.keys(obj).reduce((acc, key) => {
        if (!keysToDelete.has(key)) {
          const newKey = keyMapping[key] || key;
          acc[newKey] = obj[key];
        }
        // Add an index to ensure unique keys
        acc._uniqueKey = index;
        return acc;
      }, {})
    )
    .filter((sub) => sub["Source"] && !sub["Source"].includes("See tab"));
};

const handleInput = (e) => {
  filterText.value = e.target.value.toLowerCase();
  subsFilteredByMake.value = unfilteredSubs.value.filter((sub) =>
    sub.Make.toLowerCase().includes(filterText.value)
  );
};

const generateRandomHexColour = () => {
  const n = (Math.random() * 0xfffff * 1000000).toString(16);
  return "#" + n.slice(0, 6);
};

const handleSubSelected = (subwoofer) => {
  subwoofersSelected.value.push(subwoofer);

  const label = `${subwoofer.Make} ${subwoofer.Model}`;

  const data = [
    subwoofer["10Hz"],
    subwoofer["12.5Hz"],
    subwoofer["15Hz"],
    subwoofer["20Hz"],
    subwoofer["25Hz"],
    subwoofer["31.5Hz"],
    subwoofer["40Hz"],
    subwoofer["50Hz"],
    subwoofer["63Hz"],
    subwoofer["80Hz"],
    subwoofer["100Hz"],
    subwoofer["125Hz"],
  ];

  chartData.value = {
    ...chartData.value,
    datasets: [
      ...chartData.value.datasets,
      {
        label,
        data,
        borderColor: generateRandomHexColour(),
      },
    ],
  };
};

onMounted(async () => {
  const data = await fetchData();
  const cleanedData = cleanData(data);
  unfilteredSubs.value = cleanedData;
  subsFilteredByMake.value = cleanedData;
  console.log(cleanedData);
});
</script>

<template>
  <p class="text-center">CEA-2010-A Data</p>
  <splitpanes class="default-theme">
    <pane>
      <input @input="handleInput" type="text" placeholder="Filter by make" />
      <div class="h-95v overflow-auto">
        <table class="border">
          <thead>
            <tr>
              <th class="text-left" v-for="columnName in columns" :key="columnName">
                {{ columnName }}
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- <tr v-show="subsFilteredByMake.length === 0">
              <td colspan="5">
                <p v-if="filterText">No matches found</p>
                <p v-else>Loading...</p>
              </td>
            </tr> -->
            <tr
              class="border"
              v-for="subwoofer in subsFilteredByMake"
              :key="subwoofer._uniqueKey"
              @click="() => handleSubSelected(subwoofer)"
            >
              <td>{{ subwoofer.Make }}</td>
              <td>{{ subwoofer.Model }}</td>
              <td>{{ subwoofer.Drivers }}</td>
              <td>{{ subwoofer["Driver Size"] }}</td>
              <td>{{ subwoofer.Type }}</td>
              <td>{{ subwoofer["Source"] }}</td>
              <td>{{ subwoofer["Mode"] }}</td>
              <td>{{ subwoofer["10Hz"] }}</td>
              <td>{{ subwoofer["12.5Hz"] }}</td>
              <td>{{ subwoofer["15Hz"] }}</td>
              <td>{{ subwoofer["20Hz"] }}</td>
              <td>{{ subwoofer["25Hz"] }}</td>
              <td>{{ subwoofer["31.5Hz"] }}</td>
              <td>{{ subwoofer["40Hz"] }}</td>
              <td>{{ subwoofer["50Hz"] }}</td>
              <td>{{ subwoofer["63Hz"] }}</td>
              <td>{{ subwoofer["80Hz"] }}</td>
              <td>{{ subwoofer["100Hz"] }}</td>
              <td>{{ subwoofer["125Hz"] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </pane>
    <pane>
      <splitpanes horizontal>
        <pane min-size="50">
          <Chart v-if="chartData.datasets.length > 0" :chartData="chartData"></Chart>
        </pane>
        <pane>
          <div class="h-40v overflow-auto">
            <table class="border">
              <thead>
                <tr>
                  <th class="text-left" v-for="columnName in columnsSubSelected" :key="columnName">
                    {{ columnName }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="subsFilteredByMake.length === 0">
                  <td colspan="5">
                    <p v-if="filterText">No matches found</p>
                    <p v-else>Loading...</p>
                  </td>
                </tr>
                <tr
                  class="border"
                  v-for="subwoofer in subwoofersSelected"
                  :key="subwoofer._uniqueKey"
                  @click="() => handleSubSelected(subwoofer)"
                >
                  <td>{{ subwoofer.Model }}</td>
                  <td>{{ subwoofer["Source"] }}</td>
                  <td>{{ subwoofer["Mode"] }}</td>
                  <td>{{ subwoofer["10Hz"] }}</td>
                  <td>{{ subwoofer["12.5Hz"] }}</td>
                  <td>{{ subwoofer["15Hz"] }}</td>
                  <td>{{ subwoofer["20Hz"] }}</td>
                  <td>{{ subwoofer["25Hz"] }}</td>
                  <td>{{ subwoofer["31.5Hz"] }}</td>
                  <td>{{ subwoofer["40Hz"] }}</td>
                  <td>{{ subwoofer["50Hz"] }}</td>
                  <td>{{ subwoofer["63Hz"] }}</td>
                  <td>{{ subwoofer["80Hz"] }}</td>
                  <td>{{ subwoofer["100Hz"] }}</td>
                  <td>{{ subwoofer["125Hz"] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </pane>
      </splitpanes>
    </pane>
  </splitpanes>
  >
</template>
