-- Additive: editable print labels for QR cleanliness cards.
-- Does not touch tokens, feedbacks, or photos.

ALTER TABLE "feedback_qr_codes" ADD COLUMN IF NOT EXISTS "roomNumber" TEXT;
ALTER TABLE "feedback_qr_codes" ADD COLUMN IF NOT EXISTS "printInstruction" TEXT NOT NULL DEFAULT 'Tozalik va kamchiliklar rasmini jo‘nating';
