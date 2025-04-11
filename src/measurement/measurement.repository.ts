import { Injectable } from "@nestjs/common";
import DatabaseService from "src/database/database.service";
import Measurement from "./measurement.entity";

@Injectable()
class MeasurementRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async retrieveLatest(
    offset: number = 0,
    limit: number = 100,
    measure?: string,
  ): Promise<Measurement[]> {
    // TODO: How about offline, need to check if the last measurement is already past the "offline" threshold?

    // Define measure type that are expected
    var measureSelectQuery: string = "";
    if (measure) {
      measureSelectQuery = `m.${measure}`;
    } else {
      measureSelectQuery = `m.pm25, m.pm10, m.atmp, m.rhum, m.rco2, m.o3, m.no2`;
    }

    const query = ` 
            WITH latest_measurements AS (
                SELECT 
                    location_id,
                    last(measured_at, measured_at) AS last_measured_at
                FROM 
                    measurement
                GROUP BY 
                    location_id
            )
            SELECT 
                lm.location_id AS "locationId", 
                l.location_name AS "locationName", 
                ST_X(l.coordinate) AS longitude,
                ST_Y(l.coordinate) AS latitude,
                l.sensor_type AS "sensorType",
                ${measureSelectQuery},
                lm.last_measured_at AS "measuredAt"
            FROM 
                latest_measurements lm
            JOIN 
                measurement m ON lm.location_id = m.location_id AND lm.last_measured_at = m.measured_at
            JOIN 
                location l ON m.location_id = l.id
            ORDER BY 
                lm.location_id 
            OFFSET $1 LIMIT $2; 
        `;

    const result = await this.databaseService.runQuery(query, [offset, limit]);

    return result.rows.map(
      (measurement: Partial<Measurement>) => new Measurement(measurement),
    );
  }

  async retrieveLatestByArea(
    xMin: number,
    yMin: number,
    xMax: number,
    yMax: number,
    measure?: string,
  ): Promise<Measurement[]> {
    // Define measure type that are expected
    var measureSelectQuery: string = "";
    if (measure) {
      measureSelectQuery = `m.${measure}`;
    } else {
      measureSelectQuery = `m.pm25, m.pm10, m.atmp, m.rhum, m.rco2, m.o3, m.no2`;
    }

    // Format query
    const query = `
            WITH latest_measurements AS (
                SELECT 
                    l.id AS location_id,
                    LAST(m.measured_at, m.measured_at) AS last_measured_at
                FROM 
                    measurement m
                JOIN location l 
                    ON m.location_id = l.id 
                WHERE 
                    ST_Within(
                        coordinate,
                        ST_MakeEnvelope($1, $2, $3, $4, 3857)
                    )
                GROUP BY 
                    l.id
            )
            SELECT 
                lm.location_id AS "locationId", 
                l.location_name AS "locationName", 
                ST_X(l.coordinate) AS longitude,
                ST_Y(l.coordinate) AS latitude,
                l.sensor_type AS "sensorType",
                ${measureSelectQuery},
                lm.last_measured_at AS "measuredAt"
            FROM 
                latest_measurements lm
            JOIN 
                measurement m ON lm.location_id = m.location_id AND lm.last_measured_at = m.measured_at
            JOIN 
                location l ON m.location_id = l.id;
        `;

    // Execute query with query params value
    const result = await this.databaseService.runQuery(query, [
      xMin,
      yMin,
      xMax,
      yMax,
    ]);

    // Return rows while map the result first to measurement entity
    return result.rows.map(
      (measurement: Partial<Measurement>) => new Measurement(measurement),
    );
  }
}

export default MeasurementRepository;

