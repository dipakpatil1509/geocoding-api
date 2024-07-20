import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
	AdmLayer,
	AdmLayerType,
	Location,
	Prisma,
	UserEnteredAddress,
} from '@prisma/client';
import * as qs from 'qs';
import axios from 'axios';

type ResponseData = {
	latitude: string;
	longitude: string;
	location_name: string;
	adm0: string;
	adm1: string;
	adm2: string;
	adm3: string;
	adm4: string;
	adm5: string;
	street_address: string;
	locality: string;
	landmark: string;
};

interface LocationWithDetails extends Location {
	UserEnteredAddress: UserEnteredAddress;
	AdmLayer: AdmLayer[];
}

@Injectable()
export class AppService {
	constructor(private prisma: PrismaService) { }
	private readonly latLongRegex =
		/^-?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*-?(1[0-7]\d(\.\d+)?|180(\.0+)?|[1-9]?\d(\.\d+)?)$/;

	async _location_with_filter(
		filter: Prisma.LocationWhereInput,
	): Promise<LocationWithDetails[]> {
		return this.prisma.location.findMany({
			where: filter,
			include: { UserEnteredAddress: true, AdmLayer: true },
		});
	}

	async _location_using_text(
		text_input: string,
	): Promise<LocationWithDetails[] | null> {
		const fts_search = text_input.split(' ').join(' & ');
		return this._location_with_filter({
			OR: [
				{
					name: {
						search: fts_search,
					},
				},
				{
					tags: {
						search: fts_search,
					},
				},
				{
					category: {
						search: fts_search,
					},
				},
			],
		});
	}

	async _location_using_location(
		coordinates: string[],
	): Promise<LocationWithDetails[] | null> {
		const coordinates_json = JSON.stringify({
			type: 'Point',
			coordinates: coordinates,
		});

		const coordinates_reverse_json = JSON.stringify({
			type: 'Point',
			coordinates: coordinates.reverse(),
		});

		const locations: Location[] = await this.prisma.$queryRaw`
			SELECT id FROM "Location"
			WHERE ST_Equals(coordinates, ST_GeomFromGeoJSON(${coordinates_json})) or ST_Equals(coordinates, ST_GeomFromGeoJSON(${coordinates_reverse_json}));
		`;

		if (locations.length > 0) {
			return this._location_with_filter({
				id: {
					in: locations.map((loc) => loc.id),
				},
			});
		}
		return [];
	}

	async _get_OSM_data(text_input: string): Promise<ResponseData[] | []> {
		let data = qs.stringify({
			api_key: process.env.GEOCODE_KEYS,
			text: text_input,
		});
		let config = {
			method: 'get',
			maxBodyLength: Infinity,
			url: 'https://api.geocode.earth/v1/search?' + data,
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		};

		try {
			const location = await axios.request(config);
			return location.data?.features;
		} catch (error) {
			console.log('Error while getting OSM data', error);
		}
		return [];
	}

	async _get_OSM_data_coordinates(
		coordinates: string[],
	): Promise<ResponseData[] | []> {
		let data = qs.stringify({
			api_key: process.env.GEOCODE_KEYS,
			'point.lat': coordinates[1],
			'point.lon': coordinates[0],
		});

		let config = {
			method: 'get',
			maxBodyLength: Infinity,
			url: 'https://api.geocode.earth/v1/reverse?' + data,
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		};

		try {
			const location = await axios.request(config);
			return location.data?.features;
		} catch (error) {
			console.log('Error while getting OSM data', error);
		}
		return [];
	}

	_get_OSM_response(locations: any) {
		const final_result: ResponseData[] = [];
		locations?.map((feature: any) => {
			const country_data = {
				adm0: feature.properties.country,
				adm1: feature.properties.region,
				adm2: feature.properties.county,
				adm3: feature.properties.locality,
				adm4: feature.properties.village,
				adm5: feature.properties.locality,
			};
			final_result.push({
				longitude: feature.geometry.coordinates[0],
				latitude: feature.geometry.coordinates[1],
				location_name: feature.properties.name,
				...country_data,
				street_address: feature.properties.borough,
				locality: feature.properties.locality,
				landmark: feature.properties.neighbourhood,
			});
		});
		return final_result;
	}

	async _get_response(
		locations: LocationWithDetails[],
	): Promise<ResponseData[]> {
		const final_result: { id: ResponseData } | {} = {};
		type MissingDataCoordinates = {
			id: { lat: number; long: number };
		};
		const missing_data_coordinates: MissingDataCoordinates | {} = {};
		locations.map((location) => {
			const adm_details: any = {};

			location.AdmLayer.map((adm) => {
				switch (adm.type) {
					case AdmLayerType.Adm0:
						adm_details.adm0 = adm.name;
						break;
					case AdmLayerType.Adm1:
						adm_details.adm1 = adm.name;
						break;
					case AdmLayerType.Adm2:
						adm_details.adm2 = adm.name;
						break;
					case AdmLayerType.Adm3:
						adm_details.adm3 = adm.name;
						break;
					case AdmLayerType.Adm4:
						adm_details.adm4 = adm.name;
						break;
					case AdmLayerType.Adm5:
						adm_details.adm5 = adm.name;
						break;
					default:
						break;
				}
			});

			let address_details = {
				street_address: location.UserEnteredAddress.street,
				locality: location.UserEnteredAddress.locality,
				landmark: location.UserEnteredAddress.landmark,
			};

			final_result[location.id] = {
				longitude: location.longitude + '',
				latitude: location.latitude + '',
				location_name: location.name,
				...adm_details,
				...address_details,
			};

			if (
				address_details.street_address == 'NA' &&
				address_details.locality == 'NA' &&
				address_details.landmark == 'NA'
			) {
				missing_data_coordinates[location.id] = {
					lat: location.latitude,
					long: location.longitude,
				};
			}
		});

		if (Object.keys(missing_data_coordinates).length > 0) {
			console.log(missing_data_coordinates);
			const promises: Promise<ResponseData[]>[] = [];
			Object.keys(missing_data_coordinates).map((key) => {
				promises.push(
					this._get_OSM_data_coordinates([
						missing_data_coordinates[key].long,
						missing_data_coordinates[key].lat,
					]),
				);
			});
			const all_missing_results = await Promise.allSettled(promises);

			all_missing_results.map((result, i) => {
				if (result.status == 'fulfilled') {
					let id = Object.keys(missing_data_coordinates)[i];
					const missing_value = this._get_OSM_response(result.value);
					console.log(missing_value);
					final_result[id] = {
						...final_result[id],
						...missing_value[0],
					};
				}
			});
		}
		return Object.values(final_result);
	}

	async getGeocoding(text_input: string): Promise<ResponseData[] | null> {
		if (text_input.length == 0) {
			throw new BadRequestException('Text input is empty')
		}
		try {
			let locations: ResponseData[];
			if (this.latLongRegex.test(text_input)) {
				const coordinates_array = text_input
					.split(',')
					.map((cord) => cord.trim());
				locations = await this._get_response(
					await this._location_using_location(coordinates_array),
				);
				if (locations.length === 0) {
					locations = this._get_OSM_response(
						await this._get_OSM_data_coordinates(coordinates_array),
					);
				}
			} else {
				locations = await this._get_response(
					await this._location_using_text(text_input),
				);
				if (locations.length === 0) {
					locations = this._get_OSM_response(
						await this._get_OSM_data(text_input),
					);
				}
			}
			return locations;
		} catch (error) {
			console.log("Error while getting data", error)
			throw new BadRequestException('Something bad happened', { cause: error, description: error + "" })
		}
	}
}
