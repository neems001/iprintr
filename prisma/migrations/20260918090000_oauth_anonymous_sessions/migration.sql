ALTER TABLE "User"
ADD COLUMN "authProviderId" TEXT;

ALTER TABLE "PrintRecord"
ADD COLUMN "anonymousSessionHash" TEXT;

CREATE UNIQUE INDEX "User_authProviderId_key"
ON "User"("authProviderId");

CREATE INDEX "PrintRecord_userId_idx"
ON "PrintRecord"("userId");

CREATE INDEX "PrintRecord_anonymousSessionHash_idx"
ON "PrintRecord"("anonymousSessionHash");
