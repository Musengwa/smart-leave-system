


  ## Supabase auth setup (login only)

  1. Copy `.env.example` to `.env`.
  2. Add your Supabase values:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
  3. In Supabase Dashboard, create employee users from **Authentication > Users** (no public sign-up flow is used in this app).
  4. Optional: disable signups in Supabase under **Authentication > Providers > Email** by turning off "Enable email signups".

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  
