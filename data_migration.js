const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require("fs")

const locations = JSON.parse(fs.readFileSync("./mumbai_sample.json"))

async function main() {
	for (const location of locations) {

		const user_entered_address = await prisma.userEnteredAddress.create({
			data: {
				street: location.user_entered_address.street || "NA",
				locality: location.user_entered_address.locality || "NA",
				landmark: location.user_entered_address.landmark || "NA",
				// createdOn: new Date(location.user_entered_address.created_on),
				created_on: new Date(location.user_entered_address.created_on)
			}
		})


		const details = await prisma.details.create({
			data: {
				"phone": location.details.phone,
				"email": location.details.email,
				"website": location.details.website,
				"operator": location.details.operator,
				"condition": location.details.condition,
				"ticket_info": location.details.ticket_info
			}
		})

		const data = {
			name: location.name,
			coordinates: JSON.stringify({
				"type": "Point",
				"coordinates": [
					location.longitude,
					location.latitude,
				]
			}),
			latitude: location.latitude,
			longitude: location.longitude,
			tags: location.tags,
			category: location.category,
			user_entered_address_id: user_entered_address.id,
			details_id: details.id
		}

		try {
			const updated_location = await prisma.$queryRaw`
			INSERT INTO "Location" ("name", "coordinates", "latitude", "longitude", "tags", "category", "user_entered_address_id", "details_id")
			VALUES (${data.name}, ST_GeomFromGeoJSON(${data.coordinates}), ${data.latitude}, ${data.longitude}, ${data.tags}, ${data.category}, ${data.user_entered_address_id}, ${data.details_id}) 
			RETURNING id;
		`;

			const images = []
			location.images.map((img) => {
				images.push({
					path: img.path || "NA",
					tag: img.tag || "NA",
					location_id: updated_location[0].id
				})
			})

			await prisma.image.createMany({
				data: images
			})


			for (const adm_layer of location.adm_layers) {

				const adm_layer_data = {
					type: adm_layer.type,
					coordinates: JSON.stringify(adm_layer.geometry),
					name: adm_layer.properties.name,
					location_id: updated_location[0].id,
				}
				try {
					await prisma.$executeRaw`
						INSERT INTO "AdmLayer" ("type", "coordinates", "name", "location_id")
						VALUES (cast(${adm_layer_data.type} as public."AdmLayerType"), ST_GeomFromGeoJSON(${adm_layer_data.coordinates}), ${adm_layer_data.name}, ${adm_layer_data.location_id});
					`;
				} catch (error) {
					console.log(error + "")
				}

			}
		} catch (error) {
			console.log(error + "")
		}
	}
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
