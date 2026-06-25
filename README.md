# Attendance Scraper

A robust Google Chrome extension designed for community organizers and educators. It automatically extracts event attendance lists, maps aliases to verified full names using a centralized member database, and exports the data cleanly into JSON or PDF formats.

The extension integrates directly with Supabase, allowing you to synchronize profile data seamlessly while keeping your credentials secure.

---

## Key Features

- **Automated Extraction**: Pulls attendee names, profile pictures, event times, and class hours from event platforms.
- **Intelligent Name Resolution**: Cross-references participant aliases and avatars against your database to fetch their real, verified names.
- **Supabase Integration**: Sync your local scraped member directory to a remote Supabase `profiles` table in a single click.
- **Flexible Exports**: Download your attendance records as a structured `.json` file or a formatted `.pdf` document.
- **Modern UI**: A clean, intuitive popup interface with Light/Dark mode support.

---

## Security & Privacy

We prioritize your data security:
- **No Hardcoded Credentials**: Your `SUPABASE_URL` and `SUPABASE_ANON_KEY` are configured entirely locally.
- **Local Storage**: API keys are saved locally in Chrome's isolated storage environment.
- **Direct API Communication**: Data syncs directly between your browser and your Supabase instance. No intermediary servers are used.

> **Note**: Ensure Row Level Security (RLS) is appropriately configured on your Supabase `profiles` table to prevent unauthorized modifications.

---

## Installation

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the folder containing this extension.

---

## Setup & Configuration

To utilize the Member DB mapping, you must connect the extension to your Supabase project:

1. **Prepare your database**: Ensure your Supabase `profiles` table has an `avatar_url` column:
   ```sql
   ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
   ```
2. **Configure the Extension**:
   - Click the extension icon in Chrome.
   - Click **Config**.
   - Input your `Supabase URL` and `Supabase Anon Key`, then click **Save**.

---

## Workflow Guide

### 1. Building the Member Database
1. Navigate to your community's member directory page.
2. Open the extension and click **Scrape Members**.
3. Click **Download db.json** to save the local mapping. You can manually review and edit this file.
4. Select the edited `db.json` file in the extension and click **Sync** to upload the mappings to Supabase.

### 2. Generating Attendance
1. Navigate to an active event dashboard (e.g., Luma).
2. Open the extension popup. It will automatically fetch the latest mappings from your Supabase database in the background.
3. Provide an optional custom filename.
4. Click **PDF** or **JSON** to generate and download the final attendance report.

---

## Credits

Made by **Lunarmist-byte**
- [GitHub](https://github.com/Lunarmist-byte)
- [LinkedIn](https://www.linkedin.com/in/amal-s-kumar-ba69a1290/)
