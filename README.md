# Subwoofer Comparison

Compare subwoofer output measurements with an interactive catalogue, output chart, and comparison table. Built with Vue 3, Vite, Chart.js, and Tailwind CSS.

## Features

- Filter by brand, model, enclosure type, and measurement source.
- Sort specifications and output measurements in ascending or descending order.
- Select multiple subwoofers to compare output curves from 10 Hz to 125 Hz.
- See the highest output at each frequency highlighted in the comparison table.
- Show or hide columns in each table, with preferences saved in your browser.
- Use a resizable desktop layout or a stacked mobile layout with tap-to-compare chart tooltips.
- Select catalogue rows with a mouse or the Enter and Space keys.

## Data source

Measurements come from the **Subwoofer Comparison Spreadsheet**, created by **sweetchaos on Audio Science Review**:

[Open the source spreadsheet](https://docs.google.com/spreadsheets/d/1dU5OOnf3nVgctJszmfyBjaxK69dkXte6ZL6anVTW2_M/edit)

The app reads the `CEA-2010-A` tab through the Google Sheets API and displays **2 m peak SPL** measurements. Rows include their measurement source and operating mode to distinguish test configurations. Missing measurements appear as gaps in the chart.

Data is cached in browser local storage for one hour. On a later visit, older cached data is displayed while the app attempts a refresh. If refreshing fails, saved data remains available with a retry option. A first visit requires network access and a working API key.

## Run locally

Use Node.js 20 (the version used by the deployment workflow) and npm.

1. Clone the repository and install dependencies:

   ```sh
   git clone https://github.com/CrypticSignal/subwoofer-comparison.git
   cd subwoofer-comparison
   npm ci
   ```

2. Enable the Google Sheets API in your Google Cloud project and create an API key that can read the source spreadsheet. Create a `.env` file in the project root:

   ```dotenv
   VITE_API_KEY=your_google_sheets_api_key
   ```

   `.env` is ignored by Git. Vite embeds `VITE_` variables in the browser bundle, so this key is visible to visitors. Restrict it to the Google Sheets API and HTTP referrers where you run the app, including your local development origin.

3. Start the development server:

   ```sh
   npm run dev
   ```

   Open the URL printed by Vite, including the `/subwoofer-comparison/` base path. Restart the server after changing `.env`.

## Using the comparison

1. Open a column's filter control to narrow the catalogue.
2. Click a row, or focus it and press Enter or Space, to add it to the comparison. Select it again to remove it.
3. Compare the chart and the **Selected Subwoofers** table. On mobile, tap a chart frequency to see outputs and differences relative to the loudest visible curve at that frequency.
4. Use column checkboxes to hide columns and **More columns** to restore them. Use **Clear selection** to start again.

## Build and checks

```sh
# Build the static site into dist/
npm run build

# Preview the production build locally
npm run preview

# Run spreadsheet parsing tests
node --test tests/spreadsheet.test.js
```

Provide `VITE_API_KEY` when building, either through `.env` or the build environment.

## Deployment

The GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds pushes to `main` with Node.js 20 and publishes `dist/` to the `gh-pages` branch. Configure the repository's `VITE_API_KEY` Actions secret and GitHub Pages to serve that branch.

For a manual deployment, `npm run deploy` builds the site and publishes `dist/` using the `gh-pages` package. The Vite base path is `/subwoofer-comparison/`; update `base` in [`vite.config.js`](vite.config.js) if hosting under a different path.
