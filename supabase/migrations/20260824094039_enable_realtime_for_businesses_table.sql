/*
# Enable realtime for businesses table

## Problem
The businesses table is not in the Supabase realtime publication, so team members
don't see access_state changes (like owner_disabled) in real time.

## Fix
- Add businesses to the supabase_realtime publication.
- Set replica identity to FULL so UPDATE payloads include old values for change detection.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE businesses;
ALTER TABLE businesses REPLICA IDENTITY FULL;
