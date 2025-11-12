import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://skfidcacmqcmzqxchmit.supabase.co";
const supabaseAnonKey = "sb_publishable_h-15h-rxGZPP0k46ErJpjw_ROjRi-ag";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
