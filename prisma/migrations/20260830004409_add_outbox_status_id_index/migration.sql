-- CreateIndex
CREATE INDEX "idx_outbox_events_status_id" ON "outbox_events"("status", "id");
