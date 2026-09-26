/* HUT 10 PRO Supabase configuration
   Use the browser-safe Project URL + Publishable/anon key.
   Never place a service_role/secret key in this file.

   TABLE NAMES:
   Set these to the exact table names from your Supabase project.
*/
window.HUT10_SUPABASE_CONFIG = {
  url: "PASTE_YOUR_SUPABASE_PROJECT_URL",
  key: "PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY",

  tables: {
    profiles: "profiles",
    wallets: "wallets",
    investments: "investments",
    transactions: "transactions"
  }
};
