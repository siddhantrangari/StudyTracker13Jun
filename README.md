# StudyTrack 🎓

StudyTrack is a premium study-tracking web application (Single Page Application) built with native HTML5, CSS3, and JavaScript. It is designed for Indian competitive exam aspirants (UPSC, JEE, NEET) to help them manage their syllabus, track daily study time with persistent timers, log streaks, and analyze weekly performance with custom reports.

## Features

- **Personalized Syllabus subjects**: Create core study subjects with custom color labels.
- **Persistent live Focus Timer**: Start/stop study timers. The timer continues ticking accurately even if you refresh the page or restart your browser.
- **Study Streak Counter**: Maintains a consecutive day counter based on a **1-hour daily study threshold**, with a dynamic flame glow.
- **Weekly Progress Reports**: Visual stacked column charts (custom SVG-rendered) displaying hours studied per subject over the past 7 days, complete with tooltips, weekly statistics, and session logs.
- **Multi-user isolation**: Privacy-first design where users can only view their own subjects, timer states, and history.

---

## Getting Started

### 1. Run Locally
The project contains a lightweight package setup to serve the files locally.

To run it:
1. Open your terminal in the project directory.
2. Install dependencies (for serving the app):
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. The server will start on port 3000 and automatically open the application in your browser: [http://127.0.0.1:3000](http://127.0.0.1:3000).

---

## Supabase Configuration & Cloud Sync

By default, StudyTrack operates in **Offline Demo Mode** (data is saved locally in your browser's `localStorage`). To enable **Cloud Sync Mode** with your Supabase database:

### Step 1: Initialize Database Tables
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your project.
3. Click on the **SQL Editor** in the left sidebar.
4. Click **New Query**, paste the following SQL script, and click **Run**:

```sql
-- 1. Create subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create study_sessions table
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  duration_seconds INT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Users can only see and manage their own data)
CREATE POLICY "Users can manage their own subjects" ON public.subjects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sessions" ON public.study_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Step 2: Configure Client API Key
1. In the Supabase Dashboard, navigate to **Settings** (gear icon) -> **API**.
2. Copy the **anon public** API key (under "Project API keys").
3. Open `app.js` in your code editor.
4. Replace the `YOUR_SUPABASE_ANON_KEY` placeholder at the top of the file with the copied key:
   ```javascript
   const SUPABASE_ANON_KEY = 'your-copied-anon-key-here';
   ```
5. Save the file. The app will automatically connect, showing a green **Cloud Sync (Supabase)** badge in the user profile menu. All registrations, logins, subjects, and study sessions will now sync securely to your Supabase cloud database.
