-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "discordId" TEXT,
    "fivemLicense" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "province" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "foundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motto" TEXT,
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "propertyId" TEXT NOT NULL,
    "formedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL,
    "aPlayerId" TEXT NOT NULL,
    "bPlayerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "address" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "marketValue" DECIMAL(12,2) NOT NULL,
    "acquiredAt" TIMESTAMP(3),

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "plate" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "stolen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "familyId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "isFront" BOOLEAN NOT NULL DEFAULT false,
    "laundering" BOOLEAN NOT NULL DEFAULT false,
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crime" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "committedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "province" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "z" DOUBLE PRECISION NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "Crime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrimePerpetrator" (
    "crimeId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "CrimePerpetrator_pkey" PRIMARY KEY ("crimeId","playerId")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "crimeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "custodyId" TEXT,
    "contamination" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storedAt" TEXT,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WitnessReport" (
    "id" TEXT NOT NULL,
    "crimeId" TEXT NOT NULL,
    "witnessRef" TEXT NOT NULL,
    "quality" DOUBLE PRECISION NOT NULL,
    "statement" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contradicted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WitnessReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warrant" (
    "id" TEXT NOT NULL,
    "crimeId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "Warrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arrest" (
    "id" TEXT NOT NULL,
    "suspectId" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "charges" TEXT[],
    "madeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "province" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "released" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Arrest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriminalRecord" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "totalArrests" INTEGER NOT NULL DEFAULT 0,
    "totalConvictions" INTEGER NOT NULL DEFAULT 0,
    "notorietyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CriminalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bribe" (
    "id" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "purpose" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bribe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gang" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "founded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "colors" TEXT,
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Gang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GangMembership" (
    "id" TEXT NOT NULL,
    "gangId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "GangMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "controllerId" TEXT,
    "control" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alliance" (
    "id" TEXT NOT NULL,
    "gangAId" TEXT NOT NULL,
    "gangBId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsEvent" (
    "id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "province" TEXT,
    "area" TEXT,
    "sourceEventIds" TEXT[],

    CONSTRAINT "NewsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadioBroadcast" (
    "id" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "audioUrl" TEXT,
    "airedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rumor" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "truthScore" DOUBLE PRECISION NOT NULL,
    "spreadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rumor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reputation" (
    "id" TEXT NOT NULL,
    "playerId" TEXT,
    "familyId" TEXT,
    "gangId" TEXT,
    "area" TEXT,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT,
    "correlationId" TEXT,
    "payload" JSONB NOT NULL,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "audioSeconds" DOUBLE PRECISION,
    "costUsd" DECIMAL(10,6) NOT NULL,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "cacheKey" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_discordId_key" ON "Player"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_fivemLicense_key" ON "Player"("fivemLicense");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_idNumber_key" ON "Identity"("idNumber");

-- CreateIndex
CREATE INDEX "Identity_playerId_idx" ON "Identity"("playerId");

-- CreateIndex
CREATE INDEX "FamilyMember_playerId_idx" ON "FamilyMember"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_familyId_playerId_key" ON "FamilyMember"("familyId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Household_propertyId_key" ON "Household"("propertyId");

-- CreateIndex
CREATE INDEX "Relationship_aPlayerId_idx" ON "Relationship"("aPlayerId");

-- CreateIndex
CREATE INDEX "Relationship_bPlayerId_idx" ON "Relationship"("bPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_aPlayerId_bPlayerId_type_key" ON "Relationship"("aPlayerId", "bPlayerId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- CreateIndex
CREATE INDEX "WitnessReport_crimeId_idx" ON "WitnessReport"("crimeId");

-- CreateIndex
CREATE UNIQUE INDEX "CriminalRecord_playerId_key" ON "CriminalRecord"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Gang_name_key" ON "Gang"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GangMembership_gangId_playerId_key" ON "GangMembership"("gangId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Alliance_gangAId_gangBId_type_key" ON "Alliance"("gangAId", "gangBId", "type");

-- CreateIndex
CREATE INDEX "Reputation_playerId_idx" ON "Reputation"("playerId");

-- CreateIndex
CREATE INDEX "Reputation_familyId_idx" ON "Reputation"("familyId");

-- CreateIndex
CREATE INDEX "Reputation_gangId_idx" ON "Reputation"("gangId");

-- CreateIndex
CREATE INDEX "Reputation_area_idx" ON "Reputation"("area");

-- CreateIndex
CREATE INDEX "EventLog_type_idx" ON "EventLog"("type");

-- CreateIndex
CREATE INDEX "EventLog_occurredAt_idx" ON "EventLog"("occurredAt");

-- CreateIndex
CREATE INDEX "EventLog_correlationId_idx" ON "EventLog"("correlationId");

-- CreateIndex
CREATE INDEX "AiUsage_provider_model_idx" ON "AiUsage"("provider", "model");

-- CreateIndex
CREATE INDEX "AiUsage_occurredAt_idx" ON "AiUsage"("occurredAt");

-- CreateIndex
CREATE INDEX "AiUsage_purpose_idx" ON "AiUsage"("purpose");

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimePerpetrator" ADD CONSTRAINT "CrimePerpetrator_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "Crime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimePerpetrator" ADD CONSTRAINT "CrimePerpetrator_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "Crime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WitnessReport" ADD CONSTRAINT "WitnessReport_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "Crime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warrant" ADD CONSTRAINT "Warrant_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "Crime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arrest" ADD CONSTRAINT "Arrest_suspectId_fkey" FOREIGN KEY ("suspectId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arrest" ADD CONSTRAINT "Arrest_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bribe" ADD CONSTRAINT "Bribe_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bribe" ADD CONSTRAINT "Bribe_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GangMembership" ADD CONSTRAINT "GangMembership_gangId_fkey" FOREIGN KEY ("gangId") REFERENCES "Gang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GangMembership" ADD CONSTRAINT "GangMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_controllerId_fkey" FOREIGN KEY ("controllerId") REFERENCES "Gang"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alliance" ADD CONSTRAINT "Alliance_gangAId_fkey" FOREIGN KEY ("gangAId") REFERENCES "Gang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alliance" ADD CONSTRAINT "Alliance_gangBId_fkey" FOREIGN KEY ("gangBId") REFERENCES "Gang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reputation" ADD CONSTRAINT "Reputation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
