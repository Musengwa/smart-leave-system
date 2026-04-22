


  ## Employee lookup login (name + email)

  1. Copy `.env.example` to `.env`.
  2. Add your Supabase values:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
  3. Keep employee records in `public.employees` (the app signs users in by matching `name` + `email` against this table).
  4. No Supabase Auth users or passwords are required for this frontend flow.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  
