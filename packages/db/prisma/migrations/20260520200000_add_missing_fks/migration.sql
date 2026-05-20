-- AddForeignKey
ALTER TABLE "Warrant" ADD CONSTRAINT "Warrant_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriminalRecord" ADD CONSTRAINT "CriminalRecord_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reputation" ADD CONSTRAINT "Reputation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reputation" ADD CONSTRAINT "Reputation_gangId_fkey" FOREIGN KEY ("gangId") REFERENCES "Gang"("id") ON DELETE SET NULL ON UPDATE CASCADE;
