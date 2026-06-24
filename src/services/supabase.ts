import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wfvahgpjghevbdnkeaqq.supabase.co'
const supabaseAnonKey = 'sb_publishable_RtT624SRQ-ThGTRbs502tA_Y68aMcPv'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
