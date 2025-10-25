-- Add default_value column to api_field_configs
ALTER TABLE public.api_field_configs 
ADD COLUMN default_value jsonb NULL;

-- Update existing records with default values for type and geo_location
UPDATE public.api_field_configs 
SET default_value = '"lapor"'::jsonb 
WHERE field_name = 'type';

UPDATE public.api_field_configs 
SET default_value = '{"lat": -6.2088, "lng": 106.8456}'::jsonb 
WHERE field_name = 'geo_location';