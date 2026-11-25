-- Add review_date column to chemotherapy_regimen_protocol if not present
ALTER TABLE chemotherapy_regimen_protocol 
ADD COLUMN IF NOT EXISTS review_date TIMESTAMP(6);
