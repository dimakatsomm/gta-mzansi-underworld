-- AlterTable
ALTER TABLE "Reputation" ADD COLUMN "axis" TEXT;

-- CreateIndex
CREATE INDEX "Reputation_axis_idx" ON "Reputation"("axis");
