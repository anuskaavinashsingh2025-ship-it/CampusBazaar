-- Add trigger to automatically mark food_listings as sold when food_orders completes
-- This is a safety net in case the chat completion handler fails

CREATE OR REPLACE FUNCTION handle_food_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE food_listings
    SET status = 'sold'
    WHERE id = (
      SELECT context_id FROM conversations
      WHERE request_id = NEW.id
        AND context_type = 'food'
      LIMIT 1
    )
    AND status = 'available';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_food_order_complete ON food_orders;

CREATE TRIGGER on_food_order_complete
AFTER UPDATE ON food_orders
FOR EACH ROW
EXECUTE FUNCTION handle_food_completion();
