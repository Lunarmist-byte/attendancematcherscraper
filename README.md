# Attendance Scraper

A Google Chrome extension that scrapes event attendance lists and event times from webpages (primarily designed for Luma event pages) and exports the data as a JSON file.

## Features

- **Time Extraction**: Scrapes the event start and end times and maps them to predefined class hours.
- **Attendee Scraping**: Extracts the names of attendees from the event page.
- **Export to JSON**: Automatically packages the scraped data (times, mapped class hours, and attendee names) into an `attendance.json` file and downloads it to your machine.

## Installation

1. Clone or download this repository to your local computer.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top right corner.
4. Click on the **Load unpacked** button.
5. Select the folder containing these extension files.

## Usage

1. Navigate to the event page you want to scrape (e.g., a Luma event page).
2. Click on the Attendance Scraper extension icon in your browser toolbar.
3. In the popup, click the **Scrape & Download** button.
4. The extension will read the page content, extract the relevant data, and prompt a download for `attendance.json`.

## Data Structure

The exported `attendance.json` file follows this format:

```json
{
  "hosts": [],
  "organizers": [],
  "attendees": ["John Doe", "Jane Smith"],
  "scraped_names": ["John Doe", "Jane Smith"],
  "time_string": "09:00 AM - 10:00 AM",
  "class_hours": [1]
}
```

## How It Works

- `manifest.json`: Defines the extension structure and required permissions (`activeTab`, `scripting`, `downloads`).
- `popup.html` & `popup.js`: Provides the user interface for the extension and handles injecting the scraping script into the active tab.
- `content.js`: Contains the scraping logic that runs on the actual page to parse event times, map them to class slots, and query the DOM for attendee names.
