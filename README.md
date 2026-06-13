# StudyTrack 🎓

StudyTrack is a premium study-tracking web application (Single Page Application) built with native HTML5, CSS3, and JavaScript. It is designed for Indian competitive exam aspirants (UPSC, JEE, NEET) to help them manage their syllabus, track daily study time with persistent timers, log streaks, and analyze weekly performance.

## Pricing Tiers & Razorpay Integration

We have integrated **Razorpay Payment Gateway (Test Mode)** to support subscription models:

- **Free Tier (Default)**:
  - Create up to **2 subjects**.
  - Ticking live sessions focus timer.
  - Study streak logging (1-hour target).
  - *Blocked*: Weekly Report analytics, stacked distribution charts, and detailed session log history are locked.
- **Premium Tier (₹199)**:
  - Create **unlimited subjects**.
  - Full access to the **Weekly Report** (animated SVG stacked bar charts and tooltips).
  - Full access to detailed session logs and history.
  - Ability to **delete accidental session entries**.
  - Gold **Crown Badge** in the sidebar.

*Test credentials used:*
- **Razorpay Key ID**: `rzp_test_SwqquWZp1VDDGx` (Test mode - you can use any valid test card details on checkout to simulate success).

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
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and open your project.
2. Click on the **SQL Editor** in the left sidebar.
3. Click **New Query**, paste the following SQL script, and click **Run**:

```sql
-- Drop existing policies if they exist to prevent duplicate creation errors
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.study_sessions;

-- 1. Create profiles table (User Subscription States)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_premium BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create study_sessions table
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

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Create Policies (Users can only see and manage their own data)
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can manage their own subjects" ON public.subjects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sessions" ON public.study_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Step 2: Configure Client API Key
1. In the Supabase Dashboard, navigate to **Settings** (gear icon) -> **API**.
2. Copy the **anon public** API key.
3. Open `app.js` in your code editor and verify that the `SUPABASE_ANON_KEY` is set to your key:
   ```javascript
   const SUPABASE_ANON_KEY = 'your-copied-anon-key-here';
   ```
4. Save the file. The app will automatically connect, showing a green **Cloud Sync (Supabase)** badge in the user profile menu. All registrations, logins, subjects, and study sessions will now sync securely to your Supabase cloud database.
