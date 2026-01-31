-- Remove duplicate triggers that conflict with the application-layer logic.
-- The application now handles these notifications via 'notifyActiveValets' in the frontend/hooks.

-- 1. Drop trigger for Extras/Consumptions/Damages/Promos
DROP TRIGGER IF EXISTS trigger_notify_cochero_items ON sales_order_items;

-- 2. Drop trigger for Room Changes
DROP TRIGGER IF EXISTS trigger_notify_cochero_room_change ON room_stays;

-- 3. Optionally drop the function if no longer used (commented out for safety, or we can drop it)
-- DROP FUNCTION IF EXISTS notify_cochero_event();

-- NOTE: This stops the database from automatically inserting rows into 'notifications' 
-- table for these events, preventing the "Double Notification" issue where:
-- Notification 1: Created by React App (notifyActiveValets)
-- Notification 2: Created by this DB Trigger
