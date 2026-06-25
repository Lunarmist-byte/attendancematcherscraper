# Attendance & Member Scraper

A Google Chrome extension that scrapes event attendance lists and maps them to real names from your member database. It supports syncing profile images directly to your Supabase database to ensure every export uses verified full names instead of platform aliases.

## Features

1. **Member DB Scraper**: Scrape your central member directory to map profile images to full names and emails.
2. **Supabase Syncing**: Review and sync the scraped database mappings directly to your Supabase `profiles` table.
3. **Attendance Extraction**: Automatically extracts the event start/end times, maps them to class hours, and grabs all attendee names and profile pictures.
4. **Name Resolution**: Compares attendee profile pictures against your Supabase database and replaces shortened aliases with verified Full Names.
5. **Export Formats**: Export the final curated list as a clean JSON file or formatted PDF.

## Security Best Practices

We prioritize the security of your Supabase database:
- **No Hardcoded Keys**: The `SUPABASE_URL` and `SUPABASE_ANON_KEY` are NEVER committed to this repository.
- **Secure Local Storage**: Keys are securely inputted via the Extension Options page and stored locally in Chrome's isolated extension storage.
- **Review Before Sync**: The extension provides a full JSON review UI so you can confirm exact changes before making any API requests to Supabase.
- **Table Security**: When setting up your Supabase project, ensure that Row Level Security (RLS) is enabled so that public users cannot arbitrarily modify your profiles. Ensure the API key you provide has the appropriate permissions.

## Installation

1. Clone or download this repository to your local computer.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top right corner.
4. Click on the **Load unpacked** button and select this folder.

## Setup Supabase Integration

To use the Member DB mapping, you must connect your database:
1. In your Supabase SQL Editor, ensure your table is ready:
   `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;`
2. Click the extension icon in Chrome and click **⚙️ Setup Database**.
3. Paste your `SUPABASE_URL` and `SUPABASE_ANON_KEY` and click **Save**.

## Usage Workflow

**Step 1: Scrape & Edit your Member DB**
1. Navigate to your member directory page.
2. Click **Download Members DB (JSON)** in the extension popup.
3. This will download a `db.json` file to your computer. You can open it in any text editor to make manual corrections or remove entries.

**Step 2: Sync to Supabase**
1. Click the extension icon.
2. Under "Upload db.json to Supabase", click **Choose File** and select your edited `db.json`.
3. Click **Sync to Supabase** to securely update your database.

**Step 2: Generate Attendance**
1. Navigate to an event page (e.g., Luma event dashboard).
2. The extension will automatically download the mapped database in the background.
3. Type your preferred filename in the input box.
4. Click **Download JSON** or **Download PDF**.
