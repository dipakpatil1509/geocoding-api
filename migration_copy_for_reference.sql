CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "AdmLayerType" AS ENUM ('Adm0', 'Adm1', 'Adm2', 'Adm3', 'Adm4', 'Adm5');

-- CreateTable
CREATE TABLE "AdmLayer" (
    "id" SERIAL NOT NULL,
    "type" "AdmLayerType" NOT NULL,
    "coordinates" geometry NOT NULL,
    "name" TEXT NOT NULL,
    "location_id" INTEGER NOT NULL,

    CONSTRAINT "AdmLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Details" (
    "id" SERIAL NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "operator" TEXT,
    "condition" TEXT,
    "ticket_info" TEXT,

    CONSTRAINT "Details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "location_id" INTEGER NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "coordinates" geometry NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "tags" TEXT,
    "category" TEXT,
    "user_entered_address_id" INTEGER,
    "details_id" INTEGER,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEnteredAddress" (
    "id" SERIAL NOT NULL,
    "street" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "landmark" TEXT NOT NULL,
    "created_on" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEnteredAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adm_layer_coordinates" ON "AdmLayer" USING GIST ("coordinates");

-- CreateIndex
CREATE UNIQUE INDEX "AdmLayer_coordinates_key" ON "AdmLayer"("coordinates");

-- CreateIndex
CREATE INDEX "location_coordinates" ON "Location" USING GIST ("coordinates");

-- CreateIndex
CREATE UNIQUE INDEX "Location_latitude_longitude_key" ON "Location"("latitude", "longitude");

CREATE INDEX location_text_search_idx ON "Location" USING GIN (to_tsvector('english', name || ' ' || tags || ' ' || category));
CREATE INDEX user_entered_address_text_search_idx ON "UserEnteredAddress" USING GIN (to_tsvector('english', street || ' ' || locality || ' ' || landmark));

-- AddForeignKey
ALTER TABLE "AdmLayer" ADD CONSTRAINT "AdmLayer_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_details_id_fkey" FOREIGN KEY ("details_id") REFERENCES "Details"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_user_entered_address_id_fkey" FOREIGN KEY ("user_entered_address_id") REFERENCES "UserEnteredAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
