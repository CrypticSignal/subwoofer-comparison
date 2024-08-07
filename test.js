// import axios from "axios";
// import { read, utils } from "xlsx";

// const url = `https://docs.google.com/spreadsheets/d/1dU5OOnf3nVgctJszmfyBjaxK69dkXte6ZL6anVTW2_M/edit?gid=834598950#gid=834598950`;
// const response = await axios.get(url, { responseType: "arraybuffer" });
// const arrayBuffer = response.data;
// const workbook = read(arrayBuffer);
// const worksheet = workbook.Sheets[workbook.SheetNames[0]];
// const allData = utils.sheet_to_json(worksheet);
// console.log(allData.length);

const response = await fetch(
  "https://sheets.googleapis.com/v4/spreadsheets/1dU5OOnf3nVgctJszmfyBjaxK69dkXte6ZL6anVTW2_M?includeGridData=true&key=AIzaSyAPw798D42jqNpzoWOXFu2aSRrxtLqC2W8"
);
const json = await response.json();
console.log(json);
